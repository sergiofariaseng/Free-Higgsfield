"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useJobs } from "@/components/useJobs";
import JustifiedRows from "@/components/JustifiedRows";
import { aspectValue, formatBytes, formatUsd, isActive, mediaUrl, timeAgo } from "@/lib/shared";
import { AFFILIATE, BRAND } from "@/lib/brand";
import { LogoTile } from "@/components/Logo";
import ExchangeNote from "@/components/ExchangeNote";
import { formatBrl, type ExchangeRate } from "@/lib/currency";

interface Stats {
  today: { usd: number; count: number };
  month: { usd: number; count: number };
  allTime: { usd: number; count: number };
  outputs: number;
  diskBytes: number;
  active: number;
  spendCap: string;
  exchange: ExchangeRate | null;
}

export default function HomePage() {
  const { jobs, loaded, error } = useJobs();
  const [stats, setStats] = useState<Stats | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const [s, c] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      setStats(s?.today ? s : null);
      setConfigured(c?.configured ?? false);
    }
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const running = jobs.filter(isActive);
  const recent = jobs.filter((j) => j.outputs.length).slice(0, 12);

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex h-[68px] items-center justify-between border-b border-edge-soft px-7">
        <h1 className="text-xl font-bold tracking-tight">Início</h1>
        <p className="hidden text-xs text-faint sm:block">{BRAND.tagline}</p>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-7">
        {error && <p role="alert" className="rounded-xl border border-danger/30 p-4 text-sm text-danger">{error}</p>}
        {configured === false && (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5 transition-colors hover:border-accent/50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink">→</span>
            <div>
              <p className="text-sm font-semibold">Conecte o Higgsfield e seu GitHub</p>
              <p className="text-xs text-faint">
                Confira as conexões em Configurações para começar.
              </p>
            </div>
          </Link>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Gasto hoje" value={formatUsd(stats?.today?.usd)} brl={formatBrl(stats?.today?.usd, stats?.exchange?.rate)} sub={`${stats?.today.count ?? 0} gerações`} />
          <Stat label="Neste mês" value={formatUsd(stats?.month?.usd)} brl={formatBrl(stats?.month?.usd, stats?.exchange?.rate)} sub={stats?.spendCap ? `limite ${formatUsd(Number(stats.spendCap))} · ≈ ${formatBrl(Number(stats.spendCap), stats.exchange?.rate)}` : "sem limite definido"} />
          <Stat label="Total acumulado" value={formatUsd(stats?.allTime.usd)} brl={formatBrl(stats?.allTime.usd, stats?.exchange?.rate)} sub={`${stats?.allTime.count ?? 0} solicitações`} />
          <Stat label="Salvo no GitHub" value={formatBytes(stats?.diskBytes ?? 0)} sub={`${stats?.outputs ?? 0} arquivos`} />
        </section>

        <ExchangeNote exchange={stats ? stats.exchange : undefined} />

        <a
          href={AFFILIATE.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center gap-2.5 rounded-2xl border border-accent/25 bg-accent/[0.04] px-5 py-5 text-center transition-all duration-200 hover:border-accent/50 hover:bg-accent/[0.08]"
        >
          <LogoTile className="size-10" />
          <span>
            <span className="block text-base font-bold tracking-tight text-text">
              {AFFILIATE.label}
              <span className="ml-1.5 inline-block text-faint transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </span>
            <span className="mt-1 block font-mono text-xs text-accent">{AFFILIATE.display}</span>
          </span>
        </a>

        <section className="grid gap-3 sm:grid-cols-2">
          <Tile
            href="/image"
            title="Gerar uma imagem"
            body="Soul, Soul Cinema, Recraft V4.1, Popcorn, Soul Reference, Soul Character."
          />
          <Tile
            href="/video"
            title="Gerar um vídeo"
            body="Kling 2.5 Turbo Pro, Hailuo 02, Seedance 2.5, Wan 2.5, entre outros."
          />
        </section>

        {running.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-faint uppercase">
              Em andamento
            </h2>
            <div className="space-y-2">
              {running.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-xl border border-edge-soft bg-panel px-4 py-3"
                >
                  <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
                  <p className="min-w-0 flex-1 truncate text-sm text-muted">{job.prompt}</p>
                  <span className="shrink-0 text-xs text-faint">{job.model_name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-faint uppercase">Recentes</h2>
            <Link href="/library" className="text-xs text-muted hover:text-text">
              Ver biblioteca →
            </Link>
          </div>

          {loaded && !recent.length ? (
            <p className="rounded-xl border border-dashed border-edge-soft px-4 py-10 text-center text-sm text-faint">
              Suas gerações aparecerão aqui.
            </p>
          ) : (
            <JustifiedRows
              targetHeight={118}
              gap={10}
              items={recent.map((job, i) => {
                const gen = job.outputs[0];
                const src = mediaUrl(gen);
                return {
                  key: job.id,
                  ratio: aspectValue(job),
                  render: (style: React.CSSProperties) => (
                    <Link
                      key={job.id}
                      href="/library"
                      title={job.prompt}
                      style={{ ...style, "--i": i } as React.CSSProperties}
                      className="rise group relative block overflow-hidden rounded-xl border border-edge-soft bg-panel-2"
                    >
                      {src && gen.kind === "video" ? (
                        <video src={src} muted playsInline preload="metadata" className="size-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        src && <img src={src} alt={job.prompt} loading="lazy" className="size-full object-cover" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2 pt-6 pb-1.5 text-2xs text-white/70">
                        {timeAgo(job.created_at)}
                      </span>
                    </Link>
                  ),
                };
              })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, brl }: { label: string; value: string; sub: string; brl?: string }) {
  return (
    <div className="rounded-xl border border-edge-soft bg-panel px-4 py-3.5">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 font-mono text-xl tracking-tight text-text">{value}</p>
      {brl !== undefined && (
        <p className="mt-1 font-mono text-base font-semibold text-accent" aria-label={`Estimativa em reais: ${brl}`}>
          {brl === "—" ? "R$ —" : `≈ ${brl}`}
        </p>
      )}
      <p className="mt-0.5 text-2xs text-faint">{sub}</p>
    </div>
  );
}

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-edge-soft bg-panel px-4 py-4 transition-colors hover:border-edge"
    >
      <p className="text-base font-semibold text-text">
        {title}
        <span className="ml-1.5 inline-block text-faint transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </p>
      <p className="mt-1 text-xs leading-snug text-faint">{body}</p>
    </Link>
  );
}
