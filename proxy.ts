import { NextRequest, NextResponse } from "next/server";
import { COOKIE, validSession, safeEqual } from "./lib/auth";
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isMutation = !["GET","HEAD","OPTIONS"].includes(req.method);
  // Next's internal URL may use localhost behind a proxy. Compare the browser's
  // Origin with the request Host, preserving the port, rather than that URL.
  let sameOrigin = false;
  try {
    const origin = new URL(req.headers.get("origin") || "");
    sameOrigin = ["http:", "https:"].includes(origin.protocol) && origin.host === (req.headers.get("host") || req.nextUrl.host);
  } catch { /* Missing or malformed Origin must not authorize a mutation. */ }
  if (isMutation && !sameOrigin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (path === "/login" || path === "/api/auth/login" || path === "/api/health") return NextResponse.next();
  if (path === "/api/cron") {
    const secret = process.env.CRON_SECRET;
    if (!secret || !safeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    return NextResponse.next();
  }
  if (!validSession(req.cookies.get(COOKIE)?.value)) {
    return path.startsWith("/api/") ? NextResponse.json({ error: "Entre no estúdio para continuar." }, { status: 401 }) : NextResponse.redirect(new URL("/login", req.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
