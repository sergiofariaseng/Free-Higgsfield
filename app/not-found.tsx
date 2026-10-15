import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-sm text-faint">O endereço informado não existe.</p>
      <Link href="/" className="rounded-lg bg-accent px-5 py-2.5 font-bold text-accent-ink">
        Voltar ao início
      </Link>
    </div>
  );
}
