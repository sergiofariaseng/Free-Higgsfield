import { createHmac, timingSafeEqual } from "node:crypto";
function key() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("Segredo de sessão não configurado.");
  return value;
}
export function signData(purpose: string, data: unknown): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", key()).update(purpose + ":" + payload).digest("base64url");
  return payload + "." + signature;
}
export function readSignedData<T>(purpose: string, token: unknown): T | null {
  if (typeof token !== "string" || token.length > 16000) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const expected = createHmac("sha256", key()).update(purpose + ":" + payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch { return null; }
}
