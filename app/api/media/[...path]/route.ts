import { NextResponse } from "next/server";
import { mediaLocation } from "@/lib/github";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const file = (await ctx.params).path.join("/");
    // Redirect to GitHub's short-lived raw URL; large videos never cross the
    // Vercel response body limit. The repository token stays on the server.
    return new NextResponse(null, { status: 302, headers: { Location: await mediaLocation(file), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (err) { return apiError(err); }
}
