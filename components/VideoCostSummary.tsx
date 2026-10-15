"use client";
import type { VideoQuote } from "@/lib/video-quote-types";
import type { ModelDef } from "@/lib/models";
import { videoSummary } from "@/lib/video-capabilities";
import { formatVideoUsd } from "@/lib/video-capabilities";

export default function VideoCostSummary({ model, params, sourceDuration, quote, loading, error, onRefresh }: {
  model: ModelDef; params: Record<string, unknown>; sourceDuration?: number; quote: VideoQuote | null; loading: boolean; error: string | null; onRefresh: () => void;
}) {
  const summary = videoSummary(model, params, sourceDuration);
  const numeric = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  const consumption = quote?.credits !== null && quote?.credits !== undefined ? `${numeric(quote.credits)} créditos da API` :
    quote?.tokens !== null && quote?.tokens !== undefined ? `${numeric(quote.tokens)} tokens` :
      quote?.billingUnit === "USD" ? "Cobrança em USD" : quote?.billingUnit === "tokens" ? "Tokens · quantidade indisponível" : "Não informado pela API";
  return <section aria-labelledby="generation-summary" className="rounded-2xl border border-edge bg-panel">
    <div className="border-b border-edge-soft p-5">
      <div className="flex items-center justify-between gap-3"><h2 id="generation-summary" className="text-lg">Resumo da geração</h2><span className="rounded-full bg-accent/10 px-2.5 py-1 text-2xs text-accent">API</span></div>
      <dl className="mt-5 space-y-3 text-sm">
        {[["Modelo", model.name], ["Duração", summary.duration], ["Formato", summary.ratio], ["Resolução", summary.resolution]].map(([label, value]) =>
          <div key={label} className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="max-w-[65%] text-right">{value}</dd></div>)}
      </dl>
    </div>
    <div className="bg-accent/5 p-5" aria-live="polite" aria-busy={loading}>
      <p className="text-xs text-muted">Custo total estimado</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-accent" data-testid="video-total">{loading ? "Calculando…" : quote?.usd !== null && quote?.usd !== undefined ? formatVideoUsd(quote.usd) : "Indisponível"}</p>
      <p className="mt-2 text-xs text-muted">{loading ? "Consultando as configurações atuais." : quote?.source === "api" ? "Cotação da API Higgsfield" : quote?.source === "configured-rate" ? "Tarifa publicada · antes de descontos" : "Preencha as referências e configurações para calcular."}</p>
      <dl className="mt-5 space-y-3 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-muted">Consumo estimado</dt><dd className="text-right">{loading ? "Calculando…" : consumption}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Saldo disponível da API</dt><dd className="text-right">{quote?.balance.status === "available" ? quote.balance.usd !== null ? formatVideoUsd(quote.balance.usd) : quote.balance.credits !== null ? `${numeric(quote.balance.credits)} créditos` : "Indisponível" : "Indisponível"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted">Saldo após geração</dt><dd className="text-right">{quote?.remainingUsd !== null && quote?.remainingUsd !== undefined ? formatVideoUsd(quote.remainingUsd) : quote?.remainingCredits !== null && quote?.remainingCredits !== undefined ? `${numeric(quote.remainingCredits)} créditos` : "Não foi possível calcular"}</dd></div>
      </dl>
      {quote?.insufficient && <p role="alert" className="mt-3 text-sm text-danger">Saldo insuficiente para esta geração.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {quote?.note && !loading && <p className="mt-4 text-xs leading-relaxed text-muted">{quote.note}</p>}
    </div>
    <div className="space-y-3 border-t border-edge-soft p-5">
      <p className="text-xs leading-relaxed text-muted">O saldo da API é separado dos créditos da assinatura Higgsfield. Não fazemos conversões entre tokens, créditos e dólares.</p>
      {quote?.balance.status !== "available" && <a href="https://open.higgsfield.ai/" target="_blank" rel="noreferrer" className="block text-xs text-accent">Conferir saldo no console Higgsfield API ↗</a>}
      <button type="button" onClick={onRefresh} disabled={loading} className="text-xs text-accent disabled:opacity-50">↻ Atualizar cotação</button>
    </div>
  </section>;
}
