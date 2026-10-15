"use client";
import type { ModelDef } from "@/lib/models";
import { COMMON_RATIOS, durationOptions, VIDEO_KEYS } from "@/lib/video-capabilities";
import ParamPill from "./ParamPill";

export default function VideoControls({ model, params, onChange, sourceDuration }: {
  model: ModelDef; params: Record<string, unknown>; onChange: (key: string, value: unknown) => void; sourceDuration?: number;
}) {
  const duration = model.params.find(p => p.key === "duration");
  const durations = durationOptions(duration);
  const ratio = model.params.find(p => p.key === "aspect_ratio");
  const ratios = ratio?.options?.map(String) ?? [];
  const resolution = model.params.find(p => p.key === "resolution");
  const resolutions = resolution?.options?.map(String) ?? [];
  const transfer = model.referenceMode === "motion-transfer";
  const selected = "border-accent bg-accent/10 text-text ring-1 ring-accent/30";
  const idle = "border-edge bg-panel-2/40 text-muted hover:border-accent/50";
  return <section className="space-y-7" aria-label="Configurações do vídeo">
    <div>
      <h3 className="text-sm">Duração</h3>
      {durations.length ? <>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Duração do vídeo">
          {durations.map(value => <button key={String(value)} type="button" aria-pressed={String(params.duration) === String(value)} onClick={() => onChange("duration", value)}
            className={`min-w-14 rounded-xl border px-3 py-2.5 text-sm transition-colors ${String(params.duration) === String(value) ? selected : idle}`}>{value} s</button>)}
        </div>
        <p className="mt-2 text-xs text-faint">Somente durações suportadas pelo modelo selecionado.</p>
      </> : <div className="mt-3 rounded-xl border border-edge-soft bg-bg/50 p-4">
        <p className="text-sm">{transfer ? sourceDuration ? `${Math.min(sourceDuration, 30).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} segundos · do vídeo enviado` : "A duração acompanha o vídeo de referência" : "Duração definida pelo modelo"}</p>
        <p className="mt-1 text-xs text-muted">{transfer ? "Mínimo de 4 s. O Genjutsu utiliza até os primeiros 30 s e não aceita escolher a duração na API." : "Este modelo não oferece um parâmetro de duração."}</p>
      </div>}
    </div>
    <div>
      <h3 className="text-sm">Formato e proporção</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COMMON_RATIOS.map(item => {
          const supported = ratios.includes(item.value);
          return <button key={item.value} type="button" disabled={!supported} aria-pressed={params.aspect_ratio === item.value}
            title={!supported ? "A API deste modelo não permite selecionar esta proporção." : item.use}
            onClick={() => onChange("aspect_ratio", item.value)} className={`flex flex-col items-center rounded-xl border p-3 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${params.aspect_ratio === item.value ? selected : idle}`}>
            <span className="flex h-10 items-center"><span aria-hidden="true" className="rounded border-2 border-current" style={{ width: item.width, height: item.height }} /></span>
            <span className="mt-2 text-sm font-semibold">{item.label}</span>
            <span className="text-xs">{item.value}</span>
            <span className="mt-2 text-2xs text-muted">{supported ? item.use : "Não suportado"}</span>
          </button>;
        })}
      </div>
      {ratios.filter(value => !COMMON_RATIOS.some(r => r.value === value)).length > 0 && <div className="mt-2 flex flex-wrap gap-2">
        {ratios.filter(value => !COMMON_RATIOS.some(r => r.value === value)).map(value => <button type="button" key={value} aria-pressed={params.aspect_ratio === value}
          onClick={() => onChange("aspect_ratio", value)} className={`rounded-lg border px-3 py-2 text-xs ${params.aspect_ratio === value ? selected : idle}`}>{["auto", "adaptive"].includes(value) ? "Automático" : value}</button>)}
      </div>}
      <p className="mt-2 text-xs text-faint">{ratio ? "As opções desabilitadas não são aceitas por este modelo." : "A API deste modelo não aceita proporção personalizada. O formato de saída é definido pelo provedor."}</p>
    </div>
    <div>
      <h3 className="text-sm">Resolução de saída</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[...new Set(["480p", "720p", "1080p", ...resolutions])].map(value => <button key={value} type="button" disabled={!resolutions.includes(value)}
          aria-pressed={params.resolution === value} title={!resolutions.includes(value) ? "Resolução não selecionável neste modelo." : value}
          onClick={() => onChange("resolution", value)} className={`rounded-xl border px-2 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${params.resolution === value ? selected : idle}`}>
          <span className="block text-sm font-semibold">{value}</span><span className="text-xs text-muted">{value === "720p" ? "HD" : value === "1080p" ? "Full HD" : value === "480p" ? "SD" : "Alta resolução"}</span>
        </button>)}
      </div>
      <p className="mt-2 text-xs text-faint">{resolution ? "As dimensões exatas em pixels são definidas pelo provedor conforme o modelo e o formato." : "Este modelo define a resolução automaticamente; a API não oferece esse seletor."}</p>
    </div>
    {model.params.some(p => !VIDEO_KEYS.includes(p.key)) && <details className="rounded-xl border border-edge-soft p-4">
      <summary className="cursor-pointer text-sm font-semibold">Mais configurações</summary>
      <div className="mt-4 flex flex-wrap gap-2">{model.params.filter(p => !VIDEO_KEYS.includes(p.key)).map(def =>
        <ParamPill key={def.key} def={def} value={params[def.key]} onChange={value => onChange(def.key, value)} />)}</div>
    </details>}
  </section>;
}
