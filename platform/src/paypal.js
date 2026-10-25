import { getPaymentByOrder, markPaymentPaid } from "./store.js";

const apiBase = () => process.env.PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

export function isPayPalCheckoutReady() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

async function accessToken() {
  if (!isPayPalCheckoutReady()) throw new Error("Le paiement PayPal Checkout n’est pas configuré.");
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("PayPal n’a pas pu autoriser la requête.");
  return (await response.json()).access_token;
}

export async function createPayPalOrder(payment, plan, appBaseUrl) {
  const token = await accessToken();
  const response = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": payment.id
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: payment.id,
        custom_id: payment.id,
        description: `ModuBot · forfait ${plan.name} · 30 jours`,
        amount: { currency_code: "EUR", value: (payment.amount_cents / 100).toFixed(2) }
      }],
      application_context: {
        brand_name: "ModuBot",
        user_action: "PAY_NOW",
        return_url: `${appBaseUrl}/app?paypal=success`,
        cancel_url: `${appBaseUrl}/app?paypal=cancel`
      }
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("PayPal n’a pas créé la commande.");
  const approve = result.links?.find((link) => link.rel === "approve")?.href;
  if (!result.id || !approve) throw new Error("PayPal n’a pas retourné le lien de paiement.");
  return { id: result.id, approveUrl: approve };
}

export async function capturePayPalOrder(orderId, ownerId) {
  const payment = getPaymentByOrder(orderId);
  if (!payment || payment.owner_id !== ownerId || payment.payment_method !== "paypal_checkout") {
    const error = new Error("Cette commande PayPal ne correspond pas à ton compte.");
    error.status = 404;
    throw error;
  }
  if (["paid_pending_review", "approved"].includes(payment.status)) return payment;
  const token = await accessToken();
  const response = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `capture-${payment.id}`
    },
    body: "{}",
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (result.details?.some((detail) => detail.issue === "ORDER_ALREADY_CAPTURED")) {
      return verifyExistingCapture(orderId, payment, token);
    }
    throw new Error("La capture PayPal n’a pas abouti. Réessaie ou vérifie ton compte PayPal.");
  }
  const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
  const expectedValue = (payment.amount_cents / 100).toFixed(2);
  if (capture?.status !== "COMPLETED" || capture.amount?.currency_code !== payment.currency || capture.amount?.value !== expectedValue) {
    throw new Error("PayPal n’a pas confirmé le montant attendu.");
  }
  return recordPaid(payment);
}

async function verifyExistingCapture(orderId, payment, token) {
  const response = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000)
  });
  const order = await response.json().catch(() => ({}));
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!response.ok || capture?.status !== "COMPLETED" || capture.amount?.currency_code !== payment.currency
    || capture.amount?.value !== (payment.amount_cents / 100).toFixed(2)) {
    throw new Error("La capture PayPal existante n’a pas pu être vérifiée.");
  }
  return recordPaid(payment);
}

async function recordPaid(payment) {
  const updated = markPaymentPaid(payment.id);
  if (!updated) return payment;
  return updated || payment;
}

export async function verifyPayPalWebhook(req) {
  if (!isPayPalCheckoutReady() || !process.env.PAYPAL_WEBHOOK_ID) {
    const error = new Error("Webhook PayPal non configuré.");
    error.status = 503;
    throw error;
  }
  const event = JSON.parse(req.body.toString("utf8"));
  const token = await accessToken();
  const response = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.get("paypal-auth-algo"),
      cert_url: req.get("paypal-cert-url"),
      transmission_id: req.get("paypal-transmission-id"),
      transmission_sig: req.get("paypal-transmission-sig"),
      transmission_time: req.get("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    }),
    signal: AbortSignal.timeout(12000)
  });
  const verification = await response.json().catch(() => ({}));
  if (!response.ok || verification.verification_status !== "SUCCESS") {
    const error = new Error("Signature du webhook PayPal invalide.");
    error.status = 400;
    throw error;
  }
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const payment = orderId ? getPaymentByOrder(orderId) : null;
    if (payment) await recordPaid(payment);
  }
  return { received: true };
}
