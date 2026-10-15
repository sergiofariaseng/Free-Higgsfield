import { NextResponse } from "next/server";
import { listJobs } from "@/lib/db";
import { storageConfigured } from "@/lib/github";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    if (!storageConfigured()) return NextResponse.json({ error: "Para carregar a biblioteca, cadastre GITHUB_TOKEN e GITHUB_REPOSITORY no painel da Vercel → Settings → Environment Variables e faça Redeploy. A tela Configurações do aplicativo mostra as instruções e o estado da conexão." }, { status: 503 });
    const url = new URL(req.url);
    const raw = url.searchParams.get("kind");
    const kind = raw === "image" || raw === "video" ? raw : undefined;
    const requested = Number(url.searchParams.get("limit") || 1000);
    const limit = Number.isFinite(requested) ? Math.min(1000, Math.max(1, requested)) : 1000;
    return NextResponse.json({ jobs: await listJobs({ kind, limit }) });
  } catch (err) { return apiError(err); }
}
