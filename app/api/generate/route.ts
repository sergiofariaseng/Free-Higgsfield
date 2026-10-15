import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { parseGenerationRequest } from "@/lib/payload";
import { mutate, TERMINAL } from "@/lib/db";
import { estimate, hasCredentials, isMetered, MissingCredentialsError } from "@/lib/higgsfield";
import { StoreError } from "@/lib/github";
import { confirmedVideo, quoteVideo, checkRepriced, type VideoApproval } from "@/lib/video-pricing";
import { balanceAfter } from "@/lib/api-balance";
import type { VideoQuote } from "@/lib/video-quote-types";
import { apiError } from "@/lib/api";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    if (!hasCredentials()) throw new MissingCredentialsError();
    const raw = await req.json();
    const request = parseGenerationRequest(raw);
    const { model, endpoint, body, prompt, batch } = request;
    let approval: VideoApproval | undefined;
    let quote: VideoQuote | undefined;
    let usd: number | null = null;
    let credits: number | null = null;
    if (model.kind === "video") {
      approval = confirmedVideo(request, raw.confirmation);
      quote = await quoteVideo(request);
      checkRepriced(approval, quote);
      if (quote.insufficient) throw new StoreError("Saldo insuficiente na API do Higgsfield.", 402);
      if (quote.balance.status === "unavailable" && raw.balanceAcknowledged !== true) {
        throw new StoreError("Não foi possível consultar o saldo da API. Confira no console e confirme essa verificação antes de gerar.", 409);
      }
      usd = quote.usd; credits = quote.credits;
    } else {
      try { const q = await estimate(endpoint, body); if (!isMetered(q)) { usd = Number(q.usd); credits = Number(q.credits); } } catch { /* Preserve image workflow. */ }
    }
    if (usd !== null && (!Number.isFinite(usd) || usd < 0)) usd = null;
    if (credits !== null && !Number.isFinite(credits)) credits = null;
    const id = randomUUID();
    const now = Date.now();
    const savedId = await mutate(state => {
      if (approval) {
        const existing = state.jobs.find(j => j.video_approval?.id === approval!.id);
        if (existing) return existing.id;
      }
      if (quote?.balance.status === "available") {
        const active = state.jobs.filter(j => !TERMINAL.includes(j.status));
        const reservedUsd = active.reduce((sum, j) => sum + (j.est_usd ?? 0), 0);
        const reservedCredits = active.reduce((sum, j) => sum + (j.est_credits ?? 0), 0);
        if (active.some(j => j.est_usd === null) || balanceAfter(quote.balance, (usd ?? 0) + reservedUsd, credits === null ? null : credits + reservedCredits).insufficient) {
          throw new StoreError("Saldo insuficiente para esta geração e a fila ativa, ou há custos ainda desconhecidos na fila.", 402);
        }
      }
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
        ...(approval ? { video_approval: approval, source_duration: request.sourceDuration } : {}),
        outputs: [], submitted_at: null, next_poll_at: 0, created_at: now, updated_at: now });
      return id;
    });
    return NextResponse.json({ id: savedId, estUsd: usd });
  } catch (err) { return apiError(err); }
}
