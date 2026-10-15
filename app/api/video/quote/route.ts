import { NextResponse } from "next/server";
import { parseGenerationRequest, BadRequest } from "@/lib/payload";
import { quoteVideo } from "@/lib/video-pricing";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const parsed = parseGenerationRequest(await req.json(), { preview: true });
    if (parsed.model.kind !== "video") throw new BadRequest("Esta cotação é exclusiva para vídeos.");
    return NextResponse.json(await quoteVideo(parsed), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
