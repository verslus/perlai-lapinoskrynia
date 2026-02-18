import crypto from "crypto";

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function encryptOptional(value: string | undefined) {
  if (!value) return null;
  const key = process.env.EMAIL_ENCRYPTION_KEY;
  if (!key || key.length < 32) return value;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key.slice(0, 32)), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptOptional(value: string | null) {
  if (!value) return null;
  const key = process.env.EMAIL_ENCRYPTION_KEY;
  if (!key || key.length < 32 || !value.includes(":")) return value;

  const [ivHex, dataHex] = value.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key.slice(0, 32)), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
