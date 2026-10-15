import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { parseGenerationRequest } from "@/lib/payload";
import { mutate, TERMINAL } from "@/lib/db";
import { estimate, hasCredentials, isMetered, MissingCredentialsError } from "@/lib/higgsfield";
import { StoreError } from "@/lib/github";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    if (!hasCredentials()) throw new MissingCredentialsError();
    const { model, endpoint, body, prompt, batch } = parseGenerationRequest(await req.json());
    let usd: number | null = null;
    let credits: number | null = null;
    try { const q = await estimate(endpoint, body); if (!isMetered(q)) { usd = Number(q.usd); credits = Number(q.credits); } } catch { /* Visible estimate may be unavailable. */ }
    if (usd !== null && (!Number.isFinite(usd) || usd < 0)) usd = null;
    if (credits !== null && !Number.isFinite(credits)) credits = null;
    const id = randomUUID();
    const now = Date.now();
    await mutate(state => {
      if (state.jobs.filter(j => !TERMINAL.includes(j.status)).length >= 20) throw new StoreError("Há 20 gerações na fila. Aguarde antes de adicionar outras.", 409);
      const cap = Number(state.settings.spend_cap);
      // Reserve estimates for queued jobs too; the same CAS enforces the cap
      // when two browser tabs submit concurrently.
      const spent = state.jobs.filter(j => j.created_at >= now - 30 * 86400000 && !["failed","nsfw","canceled"].includes(j.status))
        .reduce((sum,j) => sum + (j.est_usd ?? 0), 0);
      if (cap > 0 && usd === null) throw new StoreError("Não foi possível estimar este modelo. Um limite ativo exige uma estimativa antes da geração.", 402);
      if (cap > 0 && spent + (usd ?? 0) > cap) throw new StoreError("Limite estimado de gastos dos últimos 30 dias atingido, incluindo a fila.", 402);
      state.jobs.push({ id, request_id: null, model_id: model.id, model_name: model.name, endpoint, kind: model.kind,
        prompt, params: body, batch, est_usd: usd, est_credits: credits, status: "pending", error: null,
        outputs: [], submitted_at: null, next_poll_at: 0, created_at: now, updated_at: now });
    });
    return NextResponse.json({ id, estUsd: usd });
  } catch (err) { return apiError(err); }
}
