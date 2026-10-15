import { NextResponse } from "next/server";
import { emptyState, readState, spendSince, TERMINAL } from "@/lib/db";
import { storageConfigured } from "@/lib/github";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const state = storageConfigured() ? await readState() : emptyState();
    const day = new Date(); day.setUTCHours(0,0,0,0);
    const month = new Date(day); month.setUTCDate(1);
    const outputs = state.jobs.flatMap(j => j.outputs).filter(g => g.local_path);
    return NextResponse.json({ today: spendSince(day.getTime(), state.jobs), month: spendSince(month.getTime(), state.jobs),
      allTime: { usd: spendSince(0,state.jobs).usd, count: state.jobs.length }, outputs: outputs.length,
      diskBytes: outputs.reduce((sum,g) => sum + (g.bytes ?? 0), 0), active: state.jobs.filter(j => !TERMINAL.includes(j.status)).length,
      spendCap: state.settings.spend_cap, exchange: null });
  } catch (err) { return apiError(err); }
}
