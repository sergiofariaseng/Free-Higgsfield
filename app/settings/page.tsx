"use client";
import { useEffect, useState } from "react";
type Settings = { higgsfield: boolean; github: boolean; cron: boolean; repository: string; branch: string; storageError: string | null; maxConcurrent: number; spendCap: string };
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [max, setMax] = useState(4);
  const [cap, setCap] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(data); setMax(data.maxConcurrent); setCap(data.spendCap);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Falha ao carregar configurações."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxConcurrent: max, spendCap: cap }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Preferências salvas no GitHub.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  return <div className="h-full overflow-y-auto">
    <header className="flex min-h-[68px] items-center justify-between border-b border-edge-soft px-5 sm:px-7"><h1 className="text-xl">Configurações</h1><button onClick={() => void load()} disabled={busy} className="text-sm text-accent">{busy ? "Verificando…" : "Verificar conexões"}</button></header>
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <section className="rounded-2xl border border-edge-soft bg-panel p-6">
        <h2 className="text-lg">Conexões do estúdio</h2><p className="mt-2 text-sm text-muted">Esta tela verifica as conexões; ela não possui campos para cadastrar chaves. Cadastre-as no painel da Vercel seguindo os passos abaixo.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Abra o painel da Vercel e selecione o projeto <strong className="text-text">free-higgsfield</strong>.</li>
          <li>Entre em <strong className="text-text">Settings → Environment Variables → Add Environment Variable</strong>.</li>
          <li>Cadastre <code>GITHUB_REPOSITORY</code> com o valor <code>sergiofariaseng/Free-Higgsfield</code> e <code>GITHUB_TOKEN</code> com seu token do GitHub. Selecione <strong className="text-text">Production</strong> e salve.</li>
          <li>No Higgsfield, clique em <strong className="text-text">Copy API key</strong>. Cadastre <code>HF_KEY</code> na Vercel com o valor completo copiado, sem separar a chave em partes.</li>
          <li>Abra <strong className="text-text">Deployments → ⋯ → Redeploy</strong>. Quando concluir, volte aqui e clique em <strong className="text-text">Verificar conexões</strong>.</li>
        </ol>
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent">Criar token do GitHub ↗</a>
        <p className="mt-2 text-xs text-muted">No GitHub, limite o token ao repositório Free-Higgsfield e habilite Repository permissions → Contents → Read and write. Cole o valor somente nas variáveis da Vercel.</p>
        <div className="mt-5 space-y-4">
          <Connection title="Higgsfield" ok={settings?.higgsfield} text="HF_KEY: cole a chave completa do botão Copy API key do Higgsfield. Sua conta precisa de acesso à API e saldo para gerar." />
          <Connection title="GitHub" ok={settings?.github} text="GITHUB_TOKEN com Contents: Read and write e GITHUB_REPOSITORY no formato proprietário/repositório." />
          <Connection title="Sincronização automática" ok={settings?.cron} text="CRON_SECRET. O agendamento padrão consulta a fila uma vez por dia; com a biblioteca aberta, a sincronização ocorre a cada 15 segundos." />
        </div>
        {settings?.storageError && <p role="alert" className="mt-4 text-sm text-danger">{settings.storageError}</p>}
      </section>
      <section className="rounded-2xl border border-edge-soft bg-panel p-6">
        <h2 className="text-lg">Sua biblioteca no GitHub</h2>
        <p className="mt-2 text-sm text-muted">Imagens e vídeos são salvos na pasta <code className="text-text">media/</code>, na branch <code className="text-text">{settings?.branch || "studio-storage"}</code>. A biblioteca exibe essas cópias após o salvamento.</p>
        <p className="mt-3 break-all font-mono text-sm text-accent">{settings?.repository || "sergiofariaseng/Free-Higgsfield"}</p>
        {settings?.github && <a href={`https://github.com/${settings.repository}/tree/${settings.branch}/media`} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent">Abrir pasta no GitHub ↗</a>}
        <p className="mt-4 text-xs text-muted">Até 40 MB por resultado e 4 MB por anexo de referência. Remover um arquivo da biblioteca não apaga versões antigas do histórico Git. Use um repositório privado se quiser manter suas mídias privadas.</p>
      </section>
      <form onSubmit={save} className="rounded-2xl border border-edge-soft bg-panel p-6">
        <h2 className="text-lg">Fila e orçamento</h2>
        <label className="mt-5 block text-sm">Gerações simultâneas<input type="number" min={1} max={10} required value={max} onChange={e => setMax(Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-edge bg-bg px-3 py-2" /></label>
        <label className="mt-5 block text-sm">Limite estimado em 30 dias (US$)<input type="number" min={0} step="0.01" placeholder="Sem limite" value={cap} onChange={e => setCap(e.target.value)} className="mt-2 block w-full rounded-lg border border-edge bg-bg px-3 py-2" /></label>
        <p className="mt-3 text-xs text-muted">Inclui estimativas das gerações na fila. Não substitui o controle de cobrança do provedor. Com limite ativo, modelos sem estimativa antecipada ficam bloqueados.</p>
        <button disabled={busy || !settings?.github} className="mt-5 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-40">Salvar preferências</button>
      </form>
      {message && <p role="status" className="rounded-xl border border-edge bg-panel p-4 text-sm">{message}</p>}
      <p className="text-xs text-faint">Acesso protegido por APP_PASSWORD e SESSION_SECRET. Trocar esses valores encerra as sessões anteriores.</p>
    </div>
  </div>;
}
function Connection({ title, ok, text }: { title: string; ok?: boolean; text: string }) {
  return <div className="rounded-xl border border-edge-soft bg-bg p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm">{title}</h3><span className={`text-xs ${ok ? "text-accent" : "text-warn"}`}>{ok ? "Configurado" : "Pendente"}</span></div><p className="mt-2 text-xs text-muted">{text}</p></div>;
}
