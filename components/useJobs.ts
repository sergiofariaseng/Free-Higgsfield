"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isActive, type Job } from "@/lib/shared";
export function useJobs(kind?: "image" | "video") {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Job[]>([]);
  const pending = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    pending.current = (async () => {
      try {
        const res = await fetch(`/api/jobs${kind ? `?kind=${kind}` : ""}`, { cache: "no-store" });
        if (res.status === 401) { window.location.assign("/login"); return; }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao carregar biblioteca.");
        latest.current = data.jobs ?? []; setJobs(latest.current); setError(null);
        if (latest.current.some(isActive)) {
          const sync = await fetch("/api/process", { method: "POST" });
          if (!sync.ok) { const problem = await sync.json(); throw new Error(problem.error || "Falha na sincronização."); }
        }
      } catch (err) { setError(err instanceof Error ? err.message : "Falha de conexão."); }
      finally { setLoaded(true); pending.current = null; }
    })();
    return pending.current;
  }, [kind]);
  useEffect(() => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function loop() {
      await refresh();
      if (!canceled) timer = setTimeout(loop, latest.current.some(isActive) ? 15_000 : 60_000);
    }
    void loop();
    return () => { canceled = true; clearTimeout(timer); };
  }, [refresh]);
  return { jobs, loaded, refresh, error };
}
