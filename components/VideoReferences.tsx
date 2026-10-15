"use client";
import { useRef } from "react";
import { acceptFor, maxRefs, refKindOf, type ModelDef } from "@/lib/models";
import type { MediaReference } from "./GenjutsuInputs";
export default function VideoReferences({ model, refs, setRefs, uploading, setUploading, onError }: {
  model: ModelDef; refs: MediaReference[]; setRefs: React.Dispatch<React.SetStateAction<MediaReference[]>>;
  uploading: boolean; setUploading: (value: boolean) => void; onError: (error: string | null) => void;
}) {
  const lock = useRef(false);
  const kind = refKindOf(model), limit = maxRefs(model);
  async function upload(files: File[]) {
    if (lock.current) return;
    lock.current = true; setUploading(true); onError(null);
    try {
      if (files.length + (limit === 1 ? 0 : refs.length) > limit) throw new Error(`Este modelo aceita até ${limit} referência(s).`);
      for (const file of files) {
        if (!file.type.startsWith(kind + "/")) throw new Error(`Este modelo aceita referência de ${kind === "image" ? "imagem" : kind === "video" ? "vídeo" : "áudio"}.`);
        if (file.size > 4 * 1024 * 1024) throw new Error("Cada referência pode ter até 4 MB.");
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha no upload.");
        const added: MediaReference = { url: data.url, name: file.name, preview: data.url, kind, duration: data.duration, videoMetadata: data.videoMetadata };
        setRefs(previous => limit === 1 ? [added] : [...previous, added].slice(0, limit));
      }
    } catch (error) { onError(error instanceof Error ? error.message : "Falha no upload."); }
    finally { lock.current = false; setUploading(false); }
  }
  return <div className="rounded-xl border border-dashed border-edge p-4" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
    <label className="block text-sm font-semibold">Referência {model.refRequired ? "obrigatória" : "opcional"}
      <input aria-label="Referências do vídeo" type="file" accept={acceptFor(kind)} multiple={limit > 1} disabled={uploading}
        className="mt-3 block w-full min-w-0 text-xs text-muted" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void upload(files); }} />
    </label>
    <p className="mt-2 text-xs text-faint">Até {limit} arquivo(s), 4 MB por arquivo. Você também pode arrastar para esta área.</p>
    {uploading && <p role="status" className="mt-2 text-xs text-accent">Enviando referência…</p>}
    <ul className="mt-3 flex flex-wrap gap-2">{refs.map((ref, index) => <li key={ref.url} className="flex max-w-full items-center gap-2 rounded-lg bg-panel-2 p-2 text-xs">
      <span className="truncate">{model.refKeys?.length ? `${index + 1}. ` : ""}{ref.name}</span>
      <button type="button" disabled={uploading} aria-label={`Remover ${ref.name}`} onClick={() => setRefs(previous => previous.filter(item => item !== ref))}>✕</button>
    </li>)}</ul>
  </div>;
}
