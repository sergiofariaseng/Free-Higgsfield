"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultParams, maxRefs, modelsByKind, supportsAttachment } from "@/lib/models";
import { parameterProblem, videoSummary } from "@/lib/video-capabilities";
import type { VideoQuote } from "@/lib/video-quote-types";
import { formatVideoUsd } from "@/lib/video-capabilities";
import { GENJUTSU_APPEARANCE_LIMIT } from "@/lib/genjutsu-fidelity";
import GenjutsuInputs, { type MediaReference } from "./GenjutsuInputs";
import VideoControls from "./VideoControls";
import VideoCostSummary from "./VideoCostSummary";
import VideoReferences from "./VideoReferences";

type QuoteState = { key: string; quote: VideoQuote | null; error: string | null };
type Review = { request: Record<string, unknown>; quote: VideoQuote; summary: ReturnType<typeof videoSummary>; model: string };

export default function VideoComposer({ onSubmitted }: { onSubmitted: () => void }) {
  const models = useMemo(() => modelsByKind("video"), []);
  const [modelId, setModelId] = useState(() => models.find(m => m.referenceMode === "motion-transfer")?.id ?? models[0].id);
  const model = models.find(m => m.id === modelId)!;
  const [params, setParams] = useState<Record<string, unknown>>(() => defaultParams(model));
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<MediaReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [now, setNow] = useState(Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const actionLock = useRef(false);
  const transfer = model.referenceMode === "motion-transfer";
  const promptLimit = transfer ? GENJUTSU_APPEARANCE_LIMIT : 10000;
  const video = refs.find(r => r.kind === "video");
  const imageRefs = refs.filter(r => r.kind === "image");
  const referencesReady = transfer ? Boolean(video) && imageRefs.length >= 1 && imageRefs.length <= 8 : !model.refRequired || refs.length > 0;
  const paramError = model.params.map(def => parameterProblem(def, params[def.key])).find(Boolean);
  const ready = referencesReady && !paramError && !uploading;
  const payload = useMemo(() => ({
    modelId, prompt: prompt.trim(), params, batch: 1,
    refUrls: (transfer ? refs.filter(r => r.kind === "image") : refs).map(r => r.url),
    ...(transfer ? { videoUrl: video?.url, videoMetadata: video?.videoMetadata } : {}),
  }), [modelId, prompt, params, refs, transfer, video]);
  const requestKey = JSON.stringify(payload);
  const currentState = quoteState?.key === requestKey ? quoteState : null;
  const quote = ready ? currentState?.quote ?? null : null;
  const expired = Boolean(quote && quote.expiresAt <= now);
  const loading = ready && (!currentState || expired);
  const valid = ready && (model.promptOptional || prompt.trim().length > 0) && prompt.length <= promptLimit;
  const canReview = valid && quote?.usd !== null && Boolean(quote?.confirmation) && !quote?.insufficient && !expired && !checking && !sending;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/video/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestKey, signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted) return;
        setQuoteState({ key: requestKey, quote: response.ok ? data : null, error: response.ok ? null : data.error || "Não foi possível calcular o custo." });
      } catch {
        if (!controller.signal.aborted) setQuoteState({ key: requestKey, quote: null, error: "Não foi possível calcular o custo. Tente novamente." });
      }
    }, 350);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [requestKey, ready, refresh]);

  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); }, 1000);
    const onFocus = () => setRefresh(value => value + 1);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => { if (expired && !review) setRefresh(value => value + 1); }, [expired, review]);
  useEffect(() => {
    if (review) { setAcknowledged(false); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [review]);

  function changeModel(id: string) {
    setModelId(id); setParams(defaultParams(models.find(m => m.id === id)!)); setRefs([]); setError(null); setQuoteState(null);
  }
  async function reviewGeneration() {
    if (!canReview || actionLock.current) return;
    actionLock.current = true; setChecking(true); setError(null);
    const snapshot = payload;
    try {
      // Always obtain a fresh server quote immediately before asking to confirm.
      const response = await fetch("/api/video/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível confirmar o custo.");
      setQuoteState({ key: JSON.stringify(snapshot), quote: data, error: null });
      if (!data.confirmation || data.usd === null || data.insufficient) throw new Error(data.insufficient ? "Saldo insuficiente na API." : "Não foi possível calcular o custo. Nenhuma geração foi iniciada.");
      setReview({ request: snapshot, quote: data, summary: videoSummary(model, params, video?.duration), model: model.name });
    } catch (error) { setError(error instanceof Error ? error.message : "Falha ao consultar custo."); }
    finally { actionLock.current = false; setChecking(false); }
  }
  async function confirmGeneration() {
    if (!review || actionLock.current || review.quote.expiresAt <= Date.now() || review.quote.balance.status === "unavailable" && !acknowledged) return;
    actionLock.current = true; setSending(true); setError(null);
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...review.request, confirmation: review.quote.confirmation, balanceAcknowledged: acknowledged }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a geração.");
      setReview(null); setQuoteState(null); setRefresh(value => value + 1); onSubmitted();
    } catch (error) { setReview(null); setError(error instanceof Error ? error.message : "Falha ao iniciar geração."); setQuoteState(null); setRefresh(value => value + 1); }
    finally { actionLock.current = false; setSending(false); }
  }

  const families = [...new Set(models.map(m => m.family ?? m.vendor))];
  return <>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <fieldset disabled={checking || sending || Boolean(review)} className="min-w-0 space-y-6 rounded-2xl border border-edge bg-panel p-4 sm:p-6">
        <div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-accent/10 px-2.5 py-1 text-2xs font-semibold text-accent">01</span><h2 className="text-lg">Configure seu vídeo</h2></div>
          <label htmlFor="video-model" className="mt-6 mb-2 block text-sm font-semibold">Modelo de IA</label>
          <select id="video-model" value={modelId} disabled={uploading} onChange={e => changeModel(e.target.value)} className="w-full min-w-0 rounded-xl border border-edge bg-bg px-3 py-3 text-sm">
            {families.map(family => <optgroup key={family} label={family}>{models.filter(m => (m.family ?? m.vendor) === family).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>)}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-muted">{model.blurb}</p>
        </div>
        {transfer ? <GenjutsuInputs refs={refs} setRefs={setRefs} uploading={uploading} setUploading={setUploading} onError={setError} resolution={String(params.resolution)} showPrice={false} /> :
          supportsAttachment(model) ? <VideoReferences model={model} refs={refs} setRefs={setRefs} uploading={uploading} setUploading={setUploading} onError={setError} /> : null}
        <div>
          <label htmlFor="video-prompt" className="mb-2 block text-sm font-semibold">{transfer ? "Detalhes da aparência" : "Descrição"} <span className="font-normal text-muted">({model.promptOptional ? "opcional" : "obrigatória"})</span></label>
          {transfer && <p id="genjutsu-fidelity-note" className="mb-3 rounded-xl border border-accent/20 bg-accent/5 p-3 text-xs leading-relaxed text-muted"><span className="font-semibold text-accent">Fidelidade de movimento automática.</span> Todas as gerações recebem instruções para preservar movimentos, gestos, poses, ritmo, sincronização e câmera do vídeo original, alterando apenas a aparência do personagem. Use este campo somente para complementar as imagens de aparência.</p>}
          <textarea id="video-prompt" value={prompt} maxLength={promptLimit} aria-describedby={transfer ? "genjutsu-fidelity-note" : undefined} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={transfer ? "Detalhes opcionais de rosto, cabelo ou roupa do personagem…" : "Descreva a cena, os movimentos e a iluminação…"}
            className="w-full resize-y rounded-xl border border-edge bg-bg p-3 text-sm leading-relaxed placeholder:text-faint" />
          <p className="mt-1 text-right text-2xs text-faint">{prompt.length.toLocaleString("pt-BR")} / {promptLimit.toLocaleString("pt-BR")}</p>
          {prompt.length > promptLimit && <p role="alert" className="mt-2 text-xs text-danger">Reduza o texto para o limite deste modelo antes de gerar.</p>}
        </div>
        <VideoControls model={model} params={params} sourceDuration={video?.duration} onChange={(key, value) => setParams(previous => ({ ...previous, [key]: value }))} />
      </fieldset>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-0">
        <VideoCostSummary model={model} params={params} sourceDuration={video?.duration} quote={quote} loading={loading} error={currentState?.error ?? null} onRefresh={() => { setQuoteState(null); setRefresh(value => value + 1); }} />
        <div className="rounded-2xl border border-edge bg-panel p-5">
          {!ready && <p className="mb-3 text-xs text-muted">{uploading ? "Aguarde o envio das referências." : paramError || (transfer ? "Adicione um vídeo e de 1 a 8 imagens para calcular o custo." : `Adicione as referências obrigatórias (até ${maxRefs(model)}).`)}</p>}
          {ready && !model.promptOptional && !prompt.trim() && <p className="mb-3 text-xs text-muted">Escreva a descrição para continuar.</p>}
          {ready && !loading && quote?.usd === null && <p className="mb-3 text-xs text-warn">Não foi possível calcular o custo. A geração fica bloqueada até obter uma cotação.</p>}
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <button type="button" onClick={reviewGeneration} disabled={!canReview} className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-bold tracking-wide text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35">
            {checking ? "CONFERINDO CUSTO…" : "GERAR VÍDEO"}
          </button>
          <p className="mt-3 text-center text-xs text-faint">Você confirma o custo na próxima etapa.</p>
        </div>
      </aside>
    </div>
    <dialog ref={dialog} aria-labelledby="confirm-video-title" onCancel={e => { if (sending) e.preventDefault(); else setReview(null); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-edge bg-panel p-6 text-text shadow-2xl backdrop:bg-black/75">
      {review && <>
        <h2 id="confirm-video-title" className="text-xl">Confirmar geração</h2>
        <p className="mt-2 text-sm text-muted">{review.model}</p>
        <p className="mt-1 text-xs text-muted">{review.summary.duration} · {review.summary.ratio} · {review.summary.resolution}</p>
        <div className="my-5 rounded-xl border border-accent/25 bg-accent/5 p-4"><p className="text-xs text-muted">Custo total estimado</p><p className="mt-1 text-2xl text-accent">{formatVideoUsd(review.quote.usd)}</p></div>
        <p className="text-xs leading-relaxed text-muted">{review.quote.note}</p>
        {review.quote.balance.status === "unavailable" ? <label className="mt-5 flex items-start gap-3 rounded-xl border border-warn/25 bg-warn/5 p-4 text-sm">
          <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1 shrink-0 accent-[var(--accent)]" />
          <span>Conferi meu saldo no console Higgsfield API. Entendo que o aplicativo não conseguiu consultar o saldo disponível nem calcular o saldo restante.</span>
        </label> : <p className="mt-5 text-sm">Saldo após geração: {review.quote.remainingUsd !== null ? formatVideoUsd(review.quote.remainingUsd) : `${review.quote.remainingCredits} créditos da API`}</p>}
        {review.quote.expiresAt <= now && <p role="alert" className="mt-3 text-sm text-warn">Cotação expirada. Volte e atualize o custo.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={sending} onClick={() => setReview(null)} className="flex-1 rounded-xl border border-edge px-4 py-3 text-sm">Voltar</button>
          <button type="button" disabled={sending || review.quote.expiresAt <= now || review.quote.balance.status === "unavailable" && !acknowledged} onClick={confirmGeneration}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-ink disabled:opacity-35">{sending ? "Enviando…" : "Confirmar e gerar"}</button>
        </div>
      </>}
    </dialog>
  </>;
}
