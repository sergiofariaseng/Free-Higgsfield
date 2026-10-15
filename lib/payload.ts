import { buildBody, getModel, resolveEndpoint, type ModelDef } from "./models";
import { GENJUTSU_RATES, validReferenceUrl } from "./genjutsu";

/**
 * Shared parsing for /api/generate and /api/estimate — both take the same shape
 * from the prompt bar, and the estimate must be built from an identical body or
 * the quoted price won't match what gets charged.
 */

export interface GenerationRequest {
  model: ModelDef;
  endpoint: string;
  body: Record<string, unknown>;
  prompt: string;
  batch: number;
  refUrls: string[];
}

export class BadRequest extends Error {}

export function parseGenerationRequest(input: unknown): GenerationRequest {
  const raw = (input ?? {}) as Record<string, unknown>;

  const model = getModel(String(raw.modelId ?? ""));
  if (!model) throw new BadRequest(`Modelo desconhecido: ${String(raw.modelId)}`);

  const prompt = String(raw.prompt ?? "").trim();
  if (prompt.length > 10000) throw new BadRequest("A descrição ultrapassa 10.000 caracteres.");
  if (!prompt && !model.promptOptional) throw new BadRequest("Informe uma descrição.");

  if (model.referenceMode === "motion-transfer") {
    if (!validReferenceUrl(raw.videoUrl)) throw new BadRequest("Informe um link HTTPS válido para o vídeo de referência do Genjutsu.");
    if (!Array.isArray(raw.refUrls) || raw.refUrls.length < 1 || raw.refUrls.length > 8 || !raw.refUrls.every(validReferenceUrl)) {
      throw new BadRequest("O Genjutsu precisa de 1 a 8 imagens de referência com links HTTPS válidos.");
    }
    const resolution = (raw.params as Record<string, unknown> | undefined)?.resolution ?? "720p";
    if (typeof resolution !== "string" || !Object.hasOwn(GENJUTSU_RATES, resolution)) throw new BadRequest("Escolha 480p, 720p ou 1080p para o Genjutsu.");
    // Allow only the documented fields; extra controls from another model
    // must not leak into this additionalProperties:false API schema.
    return { model, endpoint: model.endpoint, prompt, batch: 1, refUrls: raw.refUrls,
      body: { prompt, video_url: raw.videoUrl, image_urls: raw.refUrls, resolution } };
  }

  const refUrls = Array.isArray(raw.refUrls) ? raw.refUrls.map(String).filter(Boolean) : [];
  if (model.refRequired && refUrls.length === 0) {
    throw new BadRequest(`${model.name} precisa de uma imagem de referência.`);
  }

  const batchRaw = Number(raw.batch ?? 1);
  const batch = Number.isFinite(batchRaw) ? Math.min(4, Math.max(1, Math.round(batchRaw))) : 1;

  const params = (raw.params ?? {}) as Record<string, unknown>;
  const endpoint = resolveEndpoint(model, refUrls.length > 0);
  const body = buildBody(model, prompt, params, batch, refUrls);

  return { model, endpoint, body, prompt, batch, refUrls };
}
