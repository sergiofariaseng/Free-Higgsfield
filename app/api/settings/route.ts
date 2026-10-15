import { NextResponse } from "next/server";
import { mutate, readState } from "@/lib/db";
import { hasCredentials } from "@/lib/higgsfield";
import { storageConfigured, StoreError } from "@/lib/github";
import { apiError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  let storageError: string | null = null;
  let settings = { max_concurrent: 4, spend_cap: "" };
  let connected = false;
  if (storageConfigured()) {
    try { settings = (await readState()).settings; connected = true; }
    catch (err) { storageError = err instanceof StoreError ? err.message : "Não foi possível conectar ao GitHub."; }
  }
  return NextResponse.json({ configured: hasCredentials() && connected, higgsfield: hasCredentials(),
    github: connected, storageError, repository: process.env.GITHUB_REPOSITORY || "sergiofariaseng/Free-Higgsfield",
    branch: process.env.GITHUB_STORAGE_BRANCH || "studio-storage", cron: Boolean(process.env.CRON_SECRET),
    maxConcurrent: settings.max_concurrent, spendCap: settings.spend_cap });
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.keyId !== undefined || body.keySecret !== undefined) throw new StoreError("Configure as chaves apenas nas variáveis da Vercel.", 400);
    const max = Number(body.maxConcurrent);
    const cap = body.spendCap === "" ? "" : Number(body.spendCap);
    if (!Number.isInteger(max) || max < 1 || max > 10 || (cap !== "" && (!Number.isFinite(cap) || cap < 0))) throw new StoreError("Informe simultaneidade de 1 a 10 e um limite de gastos válido.", 400);
    await mutate(state => { state.settings = { max_concurrent: max, spend_cap: String(cap) }; });
    return NextResponse.json({ ok: true });
  } catch (err) { return apiError(err); }
}
