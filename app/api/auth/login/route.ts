import { NextResponse } from "next/server";
import { authConfigured, COOKIE, createSession, safeEqual } from "@/lib/auth";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: "Configure APP_PASSWORD com a senha que você escolher (pode ser curta) e SESSION_SECRET com pelo menos 32 caracteres na Vercel. Depois faça um novo deploy." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  for (const [key, value] of attempts) if (value.until <= Date.now()) attempts.delete(key);
  const entry = attempts.get(ip) || { count: 0, until: Date.now() + 15 * 60_000 };
  if (entry.count >= 10) return NextResponse.json({ error: "Muitas tentativas. Tente novamente em 15 minutos." }, { status: 429 });
  let password: unknown;
  try { password = (await req.json()).password; } catch { return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 }); }
  if (typeof password !== "string" || password.length > 1024 || !safeEqual(password, process.env.APP_PASSWORD!)) {
    entry.count++; attempts.set(ip, entry);
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  attempts.delete(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, createSession(), { httpOnly: true, secure: process.env.VERCEL === "1" || new URL(req.url).protocol === "https:", sameSite: "strict", path: "/", maxAge: 7 * 24 * 3600 });
  return response;
}
