import type { ModelDef, ParamDef } from "./models";

export const VIDEO_KEYS = ["duration", "aspect_ratio", "resolution"];
export const COMMON_RATIOS = [
  { value: "9:16", label: "Vertical", use: "Reels, TikTok e Shorts", width: 18, height: 32 },
  { value: "16:9", label: "Horizontal", use: "YouTube e institucional", width: 32, height: 18 },
  { value: "1:1", label: "Quadrado", use: "Publicações sociais", width: 26, height: 26 },
  { value: "4:5", label: "Retrato", use: "Feed do Instagram", width: 24, height: 30 },
];
export function durationOptions(def?: ParamDef): Array<string | number> {
  if (!def) return [];
  if (def.type === "enum") return def.options ?? [];
  if (!["int", "float"].includes(def.type) || def.min === undefined || def.max === undefined) return [];
  const step = def.step ?? 1;
  const count = Math.floor((def.max - def.min) / step);
  if (step <= 0 || count > 120) return [];
  return Array.from({ length: count + 1 }, (_, i) => Number((def.min! + i * step).toFixed(3)));
}
export function parameterProblem(def: ParamDef, value: unknown): string | null {
  if (value === undefined || value === "") return def.required && def.default === undefined ? `Preencha ${def.label.toLowerCase()}.` : null;
  let valid = true;
  if (def.type === "enum") valid = Boolean(def.options?.some(o => String(o) === String(value)));
  else if (["int", "float", "seed"].includes(def.type)) {
    const n = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : NaN;
    valid = Number.isFinite(n) && (def.type === "float" || Number.isInteger(n)) &&
      (def.min === undefined || n >= def.min) && (def.max === undefined || n <= def.max) &&
      (!def.step || Math.abs((n - (def.min ?? 0)) / def.step - Math.round((n - (def.min ?? 0)) / def.step)) < 1e-6);
  } else if (def.type === "bool") valid = typeof value === "boolean";
  else if (def.type === "text") valid = typeof value === "string";
  return valid ? null : `${def.label}: valor não suportado por este modelo.`;
}
export function videoSummary(model: ModelDef, params: Record<string, unknown>, duration?: number) {
  const transfer = model.referenceMode === "motion-transfer";
  return {
    duration: transfer ? duration ? `${Math.min(duration, 30).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} s · do vídeo` : "Do vídeo de referência (4–30 s)" :
      params.duration !== undefined ? `${params.duration} s` : "Definida pelo modelo",
    ratio: params.aspect_ratio ? String(params.aspect_ratio) : "Definido pelo modelo",
    resolution: params.resolution ? String(params.resolution) : "Definida pelo modelo",
  };
}

/** Preserve API precision rather than rounding a quoted fraction down to cents. */
export function formatVideoUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Indisponível";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value);
}
