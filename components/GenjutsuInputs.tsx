"use client";

import { useRef, useState } from "react";
import { GENJUTSU_RATES, genjutsuListPrice, validReferenceUrl } from "@/lib/genjutsu";
import { formatUsd } from "@/lib/shared";

export interface MediaReference {
  url: string;
  name: string;
  preview: string;
  kind: "image" | "video" | "audio";
  duration?: number;
}

async function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      video.onloadedmetadata = null; video.onerror = null;
      clearTimeout(timer);
      const duration = video.duration;
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      if (error) reject(new Error(error));
      else if (!Number.isFinite(duration) || duration < 4) reject(new Error("O vídeo do Genjutsu precisa ter pelo menos 4 segundos."));
      else resolve(duration);
    };
    const timer = setTimeout(() => finish("Não foi possível ler a duração do vídeo. Use outro MP4 ou um link HTTPS."), 10_000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish("Não foi possível ler este vídeo. Use um MP4 válido.");
    video.src = url;
  });
}

export default function GenjutsuInputs({ refs, setRefs, uploading, setUploading, onError, resolution }: {
  refs: MediaReference[];
  setRefs: React.Dispatch<React.SetStateAction<MediaReference[]>>;
  uploading: boolean;
  setUploading: (value: boolean) => void;
  onError: (message: string | null) => void;
  resolution: string;
}) {
  const [videoLink, setVideoLink] = useState("");
  const [imageLink, setImageLink] = useState("");
  const locked = useRef(false);
  const video = refs.find(r => r.kind === "video");
  const images = refs.filter(r => r.kind === "image");
  const listPrice = video?.duration ? genjutsuListPrice(video.duration, resolution) : null;

  function add(reference: MediaReference) {
    setRefs(previous => reference.kind === "video"
      ? [...previous.filter(r => r.kind !== "video"), reference]
      : previous.some(r => r.url === reference.url) || previous.filter(r => r.kind === "image").length >= 8
        ? previous : [...previous, reference]);
  }
  function addLink(kind: "video" | "image") {
    const url = (kind === "video" ? videoLink : imageLink).trim();
    if (!validReferenceUrl(url)) { onError("Use um link HTTPS completo, acessível ao Higgsfield, com até 2.083 caracteres."); return; }
    if (kind === "image" && images.length >= 8) { onError("O Genjutsu aceita no máximo 8 imagens."); return; }
    const target = new URL(url);
    const name = target.pathname.split("/").filter(Boolean).pop() || target.hostname;
    add({ url, preview: url, name, kind });
    if (kind === "video") setVideoLink(""); else setImageLink("");
    onError(null);
  }
  async function upload(files: File[]) {
    if (locked.current || uploading) return;
    locked.current = true; setUploading(true); onError(null);
    let imageCount = images.length;
    try {
      if (files.filter(f => f.type === "video/mp4").length > 1) throw new Error("Escolha apenas um vídeo de referência.");
      for (const file of files) {
        const kind = file.type === "video/mp4" ? "video" : ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ? "image" : null;
        if (!kind) throw new Error("Use MP4 para vídeo ou JPEG, PNG, WebP e GIF para imagens.");
        if (file.size > 4 * 1024 * 1024) throw new Error("O upload aceita até 4 MB por arquivo. Para arquivos maiores, adicione um link HTTPS acessível ao Higgsfield.");
        if (kind === "image" && imageCount >= 8) throw new Error("O Genjutsu aceita no máximo 8 imagens.");
        const duration = kind === "video" ? await videoDuration(file) : undefined;
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha ao enviar referência.");
        if (!validReferenceUrl(data.url)) throw new Error("O upload não retornou um link de referência válido.");
        add({ url: data.url, preview: data.url, name: file.name, kind, duration });
        if (kind === "image") imageCount++;
      }
    } catch (err) { onError(err instanceof Error ? err.message : "Falha no upload."); }
    finally { locked.current = false; setUploading(false); }
  }

  return <div className="border-b border-edge-soft px-4 py-3" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
    <p className="text-sm font-semibold">Referências do Genjutsu</p>
    <p className="mt-1 text-xs text-muted">Um vídeo de pelo menos 4 s + 1 a 8 imagens. Vídeos acima de 30 s usam apenas os primeiros 30 s. A descrição é opcional.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {(["video", "image"] as const).map(kind => <fieldset key={kind} disabled={uploading} className="min-w-0 rounded-xl border border-edge-soft p-3 disabled:opacity-50">
        <legend className="px-1 text-xs font-semibold">{kind === "video" ? `Vídeo de movimento (${video ? "1/1" : "0/1"})` : `Imagens de aparência (${images.length}/8)`}</legend>
        <label className="block cursor-pointer text-xs text-accent">{kind === "video" ? "Escolher vídeo MP4" : "Escolher imagens"}
          <input aria-label={kind === "video" ? "Vídeo de referência Genjutsu" : "Imagens de referência Genjutsu"} type="file" accept={kind === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp,image/gif"} multiple={kind === "image"} className="mt-1 block w-full text-xs text-muted" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void upload(files); }} />
        </label>
        <div className="mt-2 flex gap-2">
          <input aria-label={kind === "video" ? "Link HTTPS do vídeo" : "Link HTTPS da imagem"} type="url" maxLength={2083} placeholder="Ou cole um link HTTPS" value={kind === "video" ? videoLink : imageLink} onChange={e => kind === "video" ? setVideoLink(e.target.value) : setImageLink(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(kind); } }} className="min-w-0 flex-1 rounded-lg border border-edge bg-bg px-2 py-1.5 text-xs" />
          <button type="button" onClick={() => addLink(kind)} className="text-xs text-accent">Adicionar {kind === "video" ? "vídeo" : "imagem"}</button>
        </div>
      </fieldset>)}
    </div>
    {uploading && <p role="status" className="mt-2 text-xs text-accent">Enviando referência…</p>}
    {refs.length > 0 && <ul className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-y-auto">
      {refs.map(r => <li key={`${r.kind}:${r.url}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-panel-2 px-2 py-1 text-xs">
        <span className="truncate">{r.kind === "video" ? "Vídeo" : "Imagem"}: {r.name}{r.duration ? ` · ${r.duration.toFixed(1)} s` : ""}</span>
        <button type="button" disabled={uploading} aria-label={`Remover ${r.name}`} onClick={() => setRefs(previous => previous.filter(item => item !== r))} className="text-muted">✕</button>
      </li>)}
    </ul>}
    <p className="mt-2 text-xs text-muted">Upload: até 4 MB por arquivo. Links devem abrir a mídia sem login. A duração dos vídeos por link é validada pelo provedor.</p>
    <p className="mt-1 text-xs text-warn">Preço de tabela: US$ {GENJUTSU_RATES[resolution]?.toFixed(3).replace(".", ",") ?? "—"}/s em {resolution}. Segundos arredondados para cima, antes de descontos.{listPrice !== null ? ` Total de tabela para este vídeo: ${formatUsd(listPrice)}.` : ""}</p>
  </div>;
}
