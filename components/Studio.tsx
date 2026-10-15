"use client";

import PromptBar from "./PromptBar";
import ResultGrid from "./ResultGrid";
import { useJobs } from "./useJobs";

/** Image and Video pages are the same surface over a different model set. */
export default function Studio({ kind }: { kind: "image" | "video" }) {
  const { jobs, loaded, refresh, error } = useJobs(kind);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-edge-soft px-7">
        <h1 className="text-xl font-bold tracking-tight capitalize">{kind === "image" ? "Imagem" : "Vídeo"}</h1>
        <p className="text-xs text-faint">
          {jobs.length} {jobs.length === 1 ? "geração" : "gerações"}
        </p>
      </header>

      {/* Bottom padding clears the floating composer. */}
      <div className="flex-1 overflow-y-auto px-7 pt-6 pb-72">
        {error && <p role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</p>}
        <ResultGrid
          jobs={jobs}
          loaded={loaded}
          onChanged={refresh}
          emptyTitle={kind === "image" ? "Nenhuma imagem ainda" : "Nenhum vídeo ainda"}
          emptyHint={
            kind === "image"
              ? "Descreva uma imagem abaixo e escolha um modelo para começar."
              : "Descreva uma cena abaixo ou anexe uma imagem para animá-la."
          }
        />
      </div>

      <PromptBar kind={kind} onSubmitted={refresh} />
    </div>
  );
}
