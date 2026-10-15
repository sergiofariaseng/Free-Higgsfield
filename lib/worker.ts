import { getModel } from "./models";
import { priceVideo, checkRepriced } from "./video-pricing";
import { getApiBalance, balanceAfter } from "./api-balance";
import { randomUUID } from "node:crypto";
import { mutate, readState, TERMINAL, type JobWithOutputs, type StudioState } from "./db";
import { blob, StoreError, type TreeChange } from "./github";
import { extractOutputs, getStatus, hasCredentials, HiggsfieldError, submit } from "./higgsfield";

export const MAX_MEDIA_BYTES = 40 * 1024 * 1024;
const LEASE_MS = 360_000;
const EXT: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif", "video/mp4":"mp4", "video/webm":"webm", "audio/wav":"wav", "audio/mpeg":"mp3" };

function own(state: StudioState, owner: string) {
  if (state.lease?.owner !== owner || state.lease.until <= Date.now()) throw new StoreError("A sincronização expirou; outra execução continuará.", 409);
}
async function patch(owner: string, id: string, fields: Partial<JobWithOutputs>, files: TreeChange[] = []) {
  return mutate(state => {
    own(state, owner);
    const job = state.jobs.find(j => j.id === id);
    if (!job) throw new StoreError("Geração não encontrada.", 404);
    Object.assign(job, fields, { updated_at: Date.now() });
  }, files);
}

/** Download only HTTPS media returned by Higgsfield, with bounded memory. */
export async function downloadMedia(url: string) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.username || target.password || target.port ||
    !/^[a-z\d.-]+\.[a-z]{2,}$/i.test(target.hostname) || /(^|\.)(localhost|local|internal)$/i.test(target.hostname)) throw new Error("URL de resultado inválida.");
  const response = await fetch(target, { signal: AbortSignal.timeout(60_000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Não foi possível baixar o resultado do provedor.");
  const mime = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!EXT[mime]) throw new Error("O provedor retornou um formato de mídia não suportado.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(response.headers.get("content-length")) > MAX_MEDIA_BYTES) throw new Error("O arquivo excede o limite de 40 MB do aplicativo. Baixe o original pelo link temporário.");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MEDIA_BYTES) throw new Error("O arquivo excede o limite de 40 MB do aplicativo. Baixe o original pelo link temporário.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  if (!size) throw new Error("O provedor retornou um arquivo vazio.");
  return { bytes: Buffer.concat(chunks), mime, ext: EXT[mime] };
}

async function step(owner: string, job: JobWithOutputs) {
  if (job.status === "pending") {
    if (job.video_approval) {
      try {
        const model = getModel(job.model_id);
        if (!model) throw new Error("Modelo indisponível.");
        const [price, balance] = await Promise.all([
          priceVideo({ model, endpoint: job.endpoint, body: job.params, prompt: job.prompt, batch: job.batch, refUrls: [], sourceDuration: job.source_duration }),
          getApiBalance(),
        ]);
        checkRepriced(job.video_approval, price);
        if (balanceAfter(balance, price.usd, price.credits).insufficient) throw new Error("Saldo insuficiente na API do Higgsfield.");
      } catch (err) {
        await patch(owner, job.id, { status: "failed", error: err instanceof Error ? err.message : "Não foi possível confirmar o custo. Gere uma nova cotação.", next_poll_at: 0 });
        return;
      }
    }
    // Persist the intent BEFORE sending a billable request. An ambiguous failure
    // must never cause an automatic second submission/charge.
    await patch(owner, job.id, { status: "in_progress", submission_started_at: Date.now() });
    let result;
    try { result = await submit(job.endpoint, job.params); }
    catch (err) {
      if (err instanceof HiggsfieldError && (err.retryable || err.status === 429) && err.status < 500) {
        await patch(owner, job.id, { status: "pending", submission_started_at: undefined, next_poll_at: Date.now() + Math.max(err.retryAfterMs, 30_000) });
      } else {
        const knownRejected = err instanceof HiggsfieldError && [400,401,402,403,404,422,423].includes(err.status);
        await patch(owner, job.id, { status: "failed", submission_started_at: knownRejected ? undefined : Date.now(), error: knownRejected
          ? err instanceof HiggsfieldError && err.status === 402 ? "Saldo insuficiente na API do Higgsfield. Recarregue o saldo no console da API." : "O Higgsfield recusou a geração. Confira o modelo, o saldo e as credenciais."
          : "Envio sem confirmação. Confira o histórico no Higgsfield antes de criar outra geração; não reenviamos automaticamente para evitar cobrança duplicada." });
      }
      return;
    }
    if (!result.request_id) throw new Error("O provedor não retornou o ID da solicitação.");
    // If this durable write fails, the next run reports the ambiguous submission.
    await patch(owner, job.id, { request_id: result.request_id, submitted_at: Date.now(), submission_started_at: undefined,
      status: "queued", next_poll_at: Date.now() + 15_000, error: null });
    return;
  }
  if (!job.request_id) {
    await patch(owner, job.id, { status: "failed", error: "Envio interrompido sem confirmação. Confira o histórico no Higgsfield antes de reenviar para evitar cobrança duplicada." });
    return;
  }
  if (job.status === "downloading" && job.outputs.length) {
    const index = job.outputs.findIndex(g => !g.local_path);
    if (index === -1) { await patch(owner, job.id, { status: "completed", error: null }); return; }
    const generation = job.outputs[index];
    try {
      const media = await downloadMedia(generation.remote_url!);
      const folder = generation.kind === "video" ? "videos" : generation.kind === "audio" ? "audio" : "images";
      const file = `media/${folder}/${new Date(job.created_at).toISOString().slice(0,7)}/${job.id}-${index}.${media.ext}`;
      const sha = await blob(media.bytes);
      const outputs = job.outputs.map((g,i) => i === index ? { ...g, local_path: file, mime: media.mime, bytes: media.bytes.length } : g);
      await patch(owner, job.id, { outputs, status: outputs.every(g => g.local_path) ? "completed" : "downloading", error: null, next_poll_at: 0 },
        [{ path: file, mode: "100644", type: "blob", sha }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível salvar o arquivo.";
      await patch(owner, job.id, { error: message, next_poll_at: Date.now() + (message.includes("40 MB") ? 24 * 60 * 60_000 : 60_000) });
    }
    return;
  }
  try {
    const result = await getStatus(job.request_id);
    if (result.status === "completed") {
      const outputs = extractOutputs(result).map((out,i) => ({ id: `${job.id}-${i}`, job_id: job.id, kind: out.kind,
        remote_url: out.url, local_path: null, mime: null, bytes: null, created_at: Date.now() }));
      await patch(owner, job.id, { outputs, status: outputs.length ? "downloading" : "failed", next_poll_at: 0,
        error: outputs.length ? null : "O provedor concluiu sem retornar arquivos." });
    } else if (["failed","nsfw","canceled","cancelled"].includes(result.status)) {
      await patch(owner, job.id, { status: result.status === "cancelled" ? "canceled" : result.status as JobWithOutputs["status"], error: "A geração foi encerrada pelo Higgsfield. Confira o histórico no provedor." });
    } else {
      await patch(owner, job.id, { status: result.status === "queued" ? "queued" : "in_progress", next_poll_at: Date.now() + 30_000, error: null });
    }
  } catch {
    await patch(owner, job.id, { error: "Não foi possível consultar o Higgsfield. A próxima sincronização tentará novamente sem reenviar a geração.", next_poll_at: Date.now() + 60_000 });
  }
}

/** Every action is awaited inside an HTTP invocation; no background timer. */
export async function runWorker(maxSteps = 1) {
  if (!hasCredentials()) return { processed: 0 };
  const initial = await readState();
  if (!initial.jobs.some(j => !TERMINAL.includes(j.status) && j.next_poll_at <= Date.now())) return { processed: 0 };
  const owner = randomUUID();
  const acquired = await mutate(state => {
    if (state.lease && state.lease.until > Date.now()) return false;
    state.lease = { owner, until: Date.now() + LEASE_MS };
    return true;
  });
  if (!acquired) return { processed: 0, busy: true };
  let processed = 0;
  const deadline = Date.now() + 100_000;
  try {
    while (processed < maxSteps && Date.now() < deadline) {
      const state = await readState();
      const active = state.jobs.filter(j => !TERMINAL.includes(j.status));
      const slots = state.settings.max_concurrent - active.filter(j => j.status !== "pending").length;
      const job = active.filter(j => j.next_poll_at <= Date.now() && (j.status !== "pending" || slots > 0))
        .sort((a,b) => a.updated_at - b.updated_at)[0];
      if (!job) break;
      await step(owner, job);
      processed++;
    }
  } finally {
    await mutate(state => { if (state.lease?.owner === owner) delete state.lease; });
  }
  return { processed };
}
