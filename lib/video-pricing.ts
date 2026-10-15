import { createHash, randomUUID } from "node:crypto";
import { estimate, HiggsfieldError, isMetered, MissingCredentialsError } from "./higgsfield";
import { genjutsuListPrice } from "./genjutsu";
import { getApiBalance, balanceAfter } from "./api-balance";
import { readSignedData, signData } from "./signed-data";
import type { GenerationRequest } from "./payload";
import type { VideoQuote } from "./video-quote-types";
import { StoreError } from "./github";

export interface VideoApproval {
  id: string;
  fingerprint: string;
  usd: number;
  credits: number | null;
  source: VideoQuote["source"];
  expires: number;
}
export function realAmount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export function fingerprint(request: GenerationRequest): string {
  return createHash("sha256").update(canonical({ model: request.model.id, endpoint: request.endpoint, body: request.body, sourceDuration: request.sourceDuration ?? null })).digest("hex");
}
export async function priceVideo(request: GenerationRequest): Promise<Pick<VideoQuote, "usd" | "credits" | "source" | "billingUnit" | "tokens" | "note">> {
  let note = "Não foi possível calcular o custo. Tente atualizar a cotação.";
  let billingUnit: VideoQuote["billingUnit"] = null;
  try {
    const result = await estimate(request.endpoint, request.body);
    if (isMetered(result)) {
      // A rate description is not an estimated token quantity or total.
      note = "O provedor cobra por uso, mas não informou o consumo nem o custo total antecipado.";
      billingUnit = request.model.metered ? "tokens" : null;
    } else {
      const usd = realAmount(result.usd), credits = realAmount(result.credits);
      if (usd !== null) return { usd, credits, source: "api", billingUnit: credits === null ? "USD" : "credits", tokens: null,
        note: "Cotação retornada pela API para estas configurações. A cobrança final é definida pelo Higgsfield." };
    }
  } catch (error) {
    if (error instanceof MissingCredentialsError) throw error;
    if (error instanceof HiggsfieldError && [400, 401, 402, 403, 422, 423].includes(error.status)) {
      throw new StoreError(error.status === 402 ? "Saldo insuficiente na API do Higgsfield." :
        error.status === 400 || error.status === 422 ? "A API recusou estas configurações. Revise os parâmetros e as referências." :
          "A API não autorizou a cotação. Verifique a chave e o acesso ao modelo.", error.status);
    }
  }
  if (request.model.referenceMode === "motion-transfer" && request.sourceDuration !== undefined) {
    const usd = genjutsuListPrice(request.sourceDuration, String(request.body.resolution));
    if (usd !== null) return { usd, credits: null, source: "configured-rate", billingUnit: "USD", tokens: null,
      note: "Preço de tabela da documentação Genjutsu, calculado no servidor pela duração do MP4 enviado, arredondada para cima (máximo 30 s). Antes de descontos; não é a fatura final." };
  }
  if (request.model.referenceMode === "motion-transfer") note += " Para calcular pela tarifa publicada, envie o MP4; links dependem da cotação da API.";
  return { usd: null, credits: null, source: "unavailable", billingUnit, tokens: null, note };
}
export async function quoteVideo(request: GenerationRequest): Promise<VideoQuote> {
  const [price, balance] = await Promise.all([priceVideo(request), getApiBalance()]);
  const remaining = balanceAfter(balance, price.usd, price.credits);
  const expiresAt = Date.now() + 5 * 60_000;
  const confirmation = price.usd !== null && !remaining.insufficient ? signData("video-quote", {
    id: randomUUID(), fingerprint: fingerprint(request), usd: price.usd, credits: price.credits, source: price.source, expires: expiresAt,
  } satisfies VideoApproval) : null;
  return { ...price, ...remaining, balance, expiresAt, confirmation };
}
export function confirmedVideo(request: GenerationRequest, token: unknown): VideoApproval {
  const approved = readSignedData<VideoApproval>("video-quote", token);
  if (!approved || approved.fingerprint !== fingerprint(request) || approved.expires <= Date.now() ||
      realAmount(approved.usd) === null || !approved.id) throw new StoreError("A cotação expirou ou as configurações mudaram. Atualize o custo e confirme novamente.", 409);
  return approved;
}
export function checkRepriced(approved: VideoApproval, quote: Pick<VideoQuote, "usd" | "credits" | "source">) {
  if (quote.usd === null || quote.usd !== approved.usd || quote.credits !== approved.credits || quote.source !== approved.source) {
    throw new StoreError("O preço mudou ou não pôde ser confirmado. Atualize a cotação e confirme o novo valor antes de gerar.", 409);
  }
}
