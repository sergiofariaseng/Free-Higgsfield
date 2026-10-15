import { NextResponse } from "next/server";
import { deleteGeneration } from "@/lib/db";
import { apiError } from "@/lib/api";
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json({ ok: true, ...await deleteGeneration((await ctx.params).id) }); } catch (err) { return apiError(err); }
}
