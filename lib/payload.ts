import { buildBody, getModel, resolveEndpoint, type ModelDef } from "./models";
import { parameterProblem, VIDEO_KEYS } from "./video-capabilities";
import { verifiedVideoMetadata } from "./video-metadata";
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
  sourceDuration?: number;
}

export class BadRequest extends Error {}

export function parseGenerationRequest(input: unknown, options: { preview?: boolean } = {}): GenerationRequest {
  const raw = (input ?? {}) as Record<string, unknown>;

  const model = getModel(String(raw.modelId ?? ""));
  if (!model) throw new BadRequest(`Modelo desconhecido: ${String(raw.modelId)}`);

  const prompt = String(raw.prompt ?? "").trim();
  if (prompt.length > 10000) throw new BadRequest("A descrição ultrapassa 10.000 caracteres.");
  if (!prompt && !model.promptOptional && !options.preview) throw new BadRequest("Informe uma descrição.");

  const suppliedParams = raw.params ?? {};
  if (typeof suppliedParams !== "object" || Array.isArray(suppliedParams)) throw new BadRequest("Configurações inválidas.");
  const params = { ...Object.fromEntries(model.params.filter(p => p.default !== undefined).map(p => [p.key, p.default])), ...suppliedParams };
  if (model.kind === "video") {
    for (const key of VIDEO_KEYS) {
      if (key in suppliedParams && !model.params.some(p => p.key === key)) throw new BadRequest(`${key}: este modelo não permite configurar esse parâmetro.`);
    }
    for (const def of model.params) {
      const problem = parameterProblem(def, params[def.key]);
      if (problem) throw new BadRequest(problem);
    }
  }
  if (model.referenceMode === "motion-transfer") {
    if (!validReferenceUrl(raw.videoUrl)) throw new BadRequest("Informe um link HTTPS válido para o vídeo de referência do Genjutsu.");
    if (!Array.isArray(raw.refUrls) || raw.refUrls.length < 1 || raw.refUrls.length > 8 || !raw.refUrls.every(validReferenceUrl)) {
      throw new BadRequest("O Genjutsu precisa de 1 a 8 imagens de referência com links HTTPS válidos.");
    }
    const resolution = (raw.params as Record<string, unknown> | undefined)?.resolution ?? "720p";
    if (typeof resolution !== "string" || !Object.hasOwn(GENJUTSU_RATES, resolution)) throw new BadRequest("Escolha 480p, 720p ou 1080p para o Genjutsu.");
    const metadata = verifiedVideoMetadata(raw.videoUrl, raw.videoMetadata);
    if (metadata && metadata.duration < 4) throw new BadRequest("O vídeo do Genjutsu precisa ter pelo menos 4 segundos.");
    // Allow only the documented fields; extra controls from another model
    // must not leak into this additionalProperties:false API schema.
    return { model, endpoint: model.endpoint, prompt, batch: 1, refUrls: raw.refUrls, sourceDuration: metadata?.duration,
      body: { prompt, video_url: raw.videoUrl, image_urls: raw.refUrls, resolution } };
  }

  const refUrls = Array.isArray(raw.refUrls) ? raw.refUrls.map(String).filter(Boolean) : [];
  if (model.refRequired && refUrls.length === 0) {
    throw new BadRequest(`${model.name} precisa de uma imagem de referência.`);
  }

  const batchRaw = Number(raw.batch ?? 1);
  const batch = Number.isFinite(batchRaw) ? Math.min(4, Math.max(1, Math.round(batchRaw))) : 1;

  const endpoint = resolveEndpoint(model, refUrls.length > 0);
  const body = buildBody(model, prompt, model.kind === "video" ? params : suppliedParams as Record<string, unknown>, batch, refUrls);

  return { model, endpoint, body, prompt, batch, refUrls };
}
