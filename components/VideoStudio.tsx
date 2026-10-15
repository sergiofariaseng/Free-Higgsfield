"use client";
import { useState } from "react";
import type { Job } from "@/lib/shared";
import VideoComposer from "./VideoComposer";
import ResultGrid from "./ResultGrid";

export default function VideoStudio({ jobs, loaded, error, refresh }: { jobs: Job[]; loaded: boolean; error: string | null; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState<"create" | "results">("create");
  return <div className="flex h-full min-w-0 flex-col">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-edge-soft px-4 py-4 sm:px-7">
      <div><h1 className="text-xl">Estúdio de vídeo</h1><p className="mt-1 text-xs text-muted">Configure, confira o custo e crie.</p></div>
      <div className="flex rounded-xl border border-edge-soft bg-panel p-1" role="group" aria-label="Visualização de vídeos">
        <button type="button" onClick={() => setTab("create")} aria-pressed={tab === "create"} className={`rounded-lg px-3 py-2 text-xs ${tab === "create" ? "bg-panel-3 text-text" : "text-muted"}`}>Criar vídeo</button>
        <button type="button" onClick={() => setTab("results")} aria-pressed={tab === "results"} className={`rounded-lg px-3 py-2 text-xs ${tab === "results" ? "bg-panel-3 text-text" : "text-muted"}`}>Resultados ({jobs.length})</button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div hidden={tab !== "create"}><VideoComposer onSubmitted={() => { void refresh(); setTab("results"); }} /></div>
        {tab === "results" && <>{error && <p role="alert" className="mb-5 rounded-xl border border-danger/25 p-4 text-sm text-danger">{error}</p>}
          <ResultGrid jobs={jobs} loaded={loaded} onChanged={refresh} emptyTitle="Seus vídeos aparecem aqui" emptyHint="Configure a geração na aba Criar vídeo. Os resultados são salvos na sua biblioteca e no GitHub." />
        </>}
      </div>
    </div>
  </div>;
}
