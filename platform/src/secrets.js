import crypto from "node:crypto";

function encryptionKey() {
  const value = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    const error = new Error("TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters");
    error.status = 503;
    throw error;
  }
  return Buffer.from(value, "hex");
}

export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    token_ciphertext: ciphertext.toString("base64"),
    token_iv: iv.toString("base64"),
    token_tag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptToken(bot) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(bot.token_iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(bot.token_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(bot.token_ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function randomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString("hex");
}
