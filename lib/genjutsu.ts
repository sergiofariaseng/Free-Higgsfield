import type { ModelDef } from "./models";

// Source: Genjutsu Motion Transfer documentation supplied by the owner,
// https://dash.higgsfield.ai/models/higgsfield/genjutsu/motion-transfer/v1.0/llms.txt
// Published prices before customer discounts; these are not live quotes.
export const GENJUTSU_RATES: Record<string, number> = { "480p": 0.318, "720p": 0.681, "1080p": 1.632 };
export const GENJUTSU: ModelDef = {
  id: "genjutsu-motion-transfer",
  name: "Genjutsu Motion Transfer",
  family: "Genjutsu",
  vendor: "higgsfield",
  kind: "video",
  endpoint: "/higgsfield/genjutsu/motion-transfer/v1.0",
  referenceMode: "motion-transfer",
  promptOptional: true,
  refImageKey: "image_urls",
  refArray: true,
  refMultiple: true,
  refRequired: true,
  maxRefImages: 8,
  priceUnit: "second",
  fromUsd: 0.318,
  blurb: "Transfere o movimento de um vídeo para 1–8 imagens. Vídeo mínimo de 4 s; usa até os primeiros 30 s.",
  params: [{ key: "resolution", label: "Quality", type: "enum", options: ["720p", "480p", "1080p"], default: "720p" }],
};

/** Reference URLs are sent to Higgsfield, never downloaded by our server. */
export function validReferenceUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 2083 || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch { return false; }
}

export function genjutsuListPrice(seconds: number, resolution: string): number | null {
  const rate = GENJUTSU_RATES[resolution];
  if (!rate || !Number.isFinite(seconds) || seconds < 4) return null;
  return Math.round(Math.ceil(Math.min(seconds, 30)) * rate * 1000) / 1000;
}
