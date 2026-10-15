"use client";

import { useMemo, useState } from "react";
import ResultGrid from "@/components/ResultGrid";
import { useJobs } from "@/components/useJobs";

export default function LibraryPage() {
  const { jobs, loaded, refresh, error } = useJobs();
  const [kind, setKind] = useState<"all" | "image" | "video">("all");
  const [model, setModel] = useState("all");
  const [query, setQuery] = useState("");
  const [clearing, setClearing] = useState(false);

  // Failed, blocked and cancelled jobs hold nothing worth keeping — Higgsfield
  // doesn't charge for them — so clearing is offered as a single action.
  const failedCount = useMemo(
    () => jobs.filter((j) => ["failed", "nsfw", "canceled"].includes(j.status)).length,
    [jobs],
  );

  async function clearFailed() {
    setClearing(true);
    try {
      const res = await fetch("/api/jobs/failed", { method: "DELETE" });
      if (!res.ok) { window.alert((await res.json()).error || "Falha ao limpar."); return; }
      await refresh();
    } finally {
      setClearing(false);
    }
  }

  const models = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.model_name))).sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        (kind === "all" || j.kind === kind) &&
        (model === "all" || j.model_name === model) &&
        (!q || j.prompt.toLowerCase().includes(q)),
    );
  }, [jobs, kind, model, query]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-edge-soft px-7 py-3.5">
        <h1 className="shrink-0 text-xl font-bold tracking-tight">Biblioteca</h1>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar descrições…"
          className="ml-2 w-56 rounded-lg border border-edge-soft bg-panel-2 px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-edge"
        />

        <div className="flex gap-1 rounded-lg border border-edge-soft bg-panel-2 p-0.5">
          {(["all", "image", "video"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-2.5 py-1 text-xs capitalize transition-colors ${
                kind === k ? "bg-panel text-text" : "text-faint hover:text-muted"
              }`}
            >
              {{ all: "Todos", image: "Imagens", video: "Vídeos" }[k]}
            </button>
          ))}
        </div>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-edge-soft bg-panel-2 px-2.5 py-1.5 text-xs text-muted outline-none"
        >
          <option value="all">Todos os modelos</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {failedCount > 0 && (
          <button
            onClick={clearFailed}
            disabled={clearing}
            className="ml-auto shrink-0 rounded-full border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs text-danger transition-colors hover:border-danger/60 hover:bg-danger/10 disabled:opacity-50"
          >
            {clearing ? "Limpando…" : `Limpar ${failedCount} sem sucesso`}
          </button>
        )}

        <p className={`shrink-0 text-xs text-faint ${failedCount > 0 ? "" : "ml-auto"}`}>
          {filtered.length} resultados
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-7 py-6">
        {error && <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</p>}
        <ResultGrid
          jobs={filtered}
          loaded={loaded}
          onChanged={refresh}
          emptyHint="Tudo o que você gera fica salvo aqui, com uma cópia dos arquivos na pasta media/ do GitHub."
        />
      </div>
    </div>
  );
}
