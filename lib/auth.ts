import { createHmac, timingSafeEqual } from "node:crypto";
export const COOKIE = "studio_session";
export function authConfigured() { return (process.env.APP_PASSWORD?.length ?? 0) > 0 && (process.env.SESSION_SECRET?.length ?? 0) >= 32; }
function signature(value: string) { return createHmac("sha256", process.env.SESSION_SECRET || "unconfigured").update(value).digest("hex"); }
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(signature(a)); const right = Buffer.from(signature(b));
  return timingSafeEqual(left,right);
}
export function createSession() {
  if (!authConfigured()) throw new Error("Configure APP_PASSWORD e SESSION_SECRET.");
  const expires = String(Date.now() + 7 * 24 * 60 * 60_000);
  return `${expires}.${signature(`${expires}:${process.env.APP_PASSWORD}`)}`;
}
export function validSession(cookie?: string) {
  if (!authConfigured() || !cookie) return false;
  const [expires, sig, extra] = cookie.split(".");
  return !extra && /^\d+$/.test(expires) && Number(expires) > Date.now() && Number(expires) <= Date.now() + 7 * 24 * 60 * 60_000 &&
    typeof sig === "string" && safeEqual(sig, signature(`${expires}:${process.env.APP_PASSWORD}`));
}
