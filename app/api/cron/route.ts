import { NextResponse } from "next/server";
import { runWorker } from "@/lib/worker";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET() { try { return NextResponse.json(await runWorker(4)); } catch (err) { return apiError(err); } }
