import { NextResponse } from "next/server";
import { assertUnlocked, deleteJob, getJob, mutate, TERMINAL } from "@/lib/db";
import { cancel } from "@/lib/higgsfield";
import { StoreError } from "@/lib/github";
import { apiError } from "@/lib/api";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const job = await getJob((await ctx.params).id);
    if (!job) throw new StoreError("Geração não encontrada.", 404);
    return NextResponse.json({ job });
  } catch (err) { return apiError(err); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const job = await getJob(id);
    if (!job) throw new StoreError("Geração não encontrada.", 404);
    if (TERMINAL.includes(job.status)) return NextResponse.json({ ok: true, removed: true, ...await deleteJob(id) });
    // Mark canceled durably before contacting the provider so the worker cannot
    // pick it up in the gap. Refuse while a worker holds the shared lease.
    const requestId = await mutate(state => {
      assertUnlocked(state);
      const current = state.jobs.find(j => j.id === id);
      if (!current || TERMINAL.includes(current.status)) throw new StoreError("A geração mudou de estado. Atualize a biblioteca.", 409);
      if (current.outputs.length) throw new StoreError("O resultado já está pronto. Aguarde o salvamento antes de remover.", 409);
      current.status = "canceled"; current.error = "Cancelamento solicitado; confira a cobrança no provedor."; current.updated_at = Date.now();
      return current.request_id;
    });
    if (requestId) { try { await cancel(requestId); } catch { /* Local cancellation remains; provider may have finished. */ } }
    return NextResponse.json({ ok: true, removed: false });
  } catch (err) { return apiError(err); }
}
