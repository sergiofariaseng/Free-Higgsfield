"use client";
import { useState } from "react";
import { LogoTile } from "@/components/Logo";
export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.assign("/");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao entrar."); }
    finally { setBusy(false); }
  }
  return <div className="grid min-h-dvh place-items-center overflow-y-auto px-5 py-10">
    <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-edge bg-panel p-8 shadow-2xl">
      <LogoTile className="mb-7 size-12" />
      <p className="mb-2 text-xs uppercase tracking-widest text-accent">Seu estúdio criativo</p>
      <h1 className="text-2xl">Free Higgsfield</h1>
      <p className="mt-3 text-sm text-muted">Crie imagens e vídeos. Guarde suas criações no GitHub e encontre tudo na sua biblioteca.</p>
      <label htmlFor="password" className="mt-8 mb-2 block text-sm">Senha de acesso</label>
      <input id="password" autoComplete="current-password" type="password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-edge bg-bg px-4 py-3 outline-none focus:border-accent" />
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-accent-ink disabled:opacity-50">{busy ? "Entrando…" : "Entrar no estúdio →"}</button>
      <p className="mt-6 text-xs text-faint">Acesso pessoal. As gerações utilizam o saldo da sua API Higgsfield.</p>
    </form>
  </div>;
}
