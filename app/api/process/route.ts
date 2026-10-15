import { NextResponse } from "next/server";
import { runWorker } from "@/lib/worker";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST() { try { return NextResponse.json(await runWorker()); } catch (err) { return apiError(err); } }
