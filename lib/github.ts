/** GitHub is the durable store. Credentials never enter Git. */
export class StoreError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export function storageConfig() {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const branch = process.env.GITHUB_STORAGE_BRANCH || "studio-storage";
  const token = process.env.GITHUB_TOKEN ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) throw new StoreError("Configure GITHUB_REPOSITORY e GITHUB_TOKEN nas variáveis da Vercel.");
  if (!/^[\w-]+$/.test(branch) || branch === (process.env.GITHUB_BASE_BRANCH || "main")) throw new StoreError("Use uma branch de armazenamento separada da branch do aplicativo.");
  return { repository, branch, token };
}
export function storageConfigured() { try { storageConfig(); return true; } catch { return false; } }
export async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { repository, token } = storageConfig();
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new StoreError(
    response.status === 404 ? "Repositório, branch ou arquivo não encontrado. Verifique o token e publique o primeiro commit em main."
      : response.status === 403 || response.status === 429 ? "O GitHub recusou o acesso ou atingiu o limite de requisições. Verifique as permissões Contents e tente novamente mais tarde."
      : `Falha ao acessar o GitHub (HTTP ${response.status}).`, response.status);
  return response.status === 204 ? undefined as T : response.json();
}
export type TreeChange = { path: string; mode: "100644"; type: "blob"; sha: string | null };
export const STATE_PATH = ".studio/state.json";
export async function blob(content: Buffer | string): Promise<string> {
  const result = await github<{ sha: string }>("/git/blobs", {
    method: "POST", body: JSON.stringify({ content: Buffer.from(content).toString("base64"), encoding: "base64" }),
  });
  return result.sha;
}
async function branchHead(): Promise<string> {
  const { branch } = storageConfig();
  try { return (await github<{ object: { sha: string } }>(`/git/ref/heads/${branch}`)).object.sha; }
  catch (err) { if (!(err instanceof StoreError) || err.status !== 404) throw err; }
  const base = encodeURIComponent(process.env.GITHUB_BASE_BRANCH || "main");
  const parent = await github<{ object: { sha: string } }>(`/git/ref/heads/${base}`);
  try { await github("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: parent.object.sha }) }); }
  catch (err) { if (!(err instanceof StoreError) || err.status !== 422) throw err; }
  return (await github<{ object: { sha: string } }>(`/git/ref/heads/${branch}`)).object.sha;
}
export async function snapshot<T>(empty: () => T): Promise<{ head: string; state: T }> {
  const head = await branchHead();
  try {
    const state = await github<T>(`/contents/${STATE_PATH}?ref=${head}`, { headers: { Accept: "application/vnd.github.raw+json" } });
    return { head, state };
  } catch (err) {
    if (err instanceof StoreError && err.status === 404) return { head, state: empty() };
    throw err;
  }
}
/** Callbacks must be synchronous and side-effect free: conflicts replay them. */
export async function transaction<T, R>(empty: () => T, change: (state: T) => R,
  files: TreeChange[] = [], message = "studio: atualizar biblioteca [skip ci]"): Promise<R> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { head, state } = await snapshot(empty);
    const before = JSON.stringify(state);
    const result = change(state);
    const content = JSON.stringify(state);
    if (content === before && files.length === 0) return result;
    if (Buffer.byteLength(content) > 4 * 1024 * 1024) throw new StoreError("O catálogo atingiu 4 MB. Arquive parte do histórico antes de continuar.");
    const commit = await github<{ tree: { sha: string } }>(`/git/commits/${head}`);
    const stateSha = await blob(content);
    const tree = await github<{ sha: string }>("/git/trees", { method: "POST", body: JSON.stringify({
      base_tree: commit.tree.sha, tree: [...files, { path: STATE_PATH, mode: "100644", type: "blob", sha: stateSha }],
    }) });
    const next = await github<{ sha: string }>("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) });
    try {
      await github(`/git/refs/heads/${storageConfig().branch}`, { method: "PATCH", body: JSON.stringify({ sha: next.sha, force: false }) });
      return result;
    } catch (err) {
      if (!(err instanceof StoreError) || ![409, 422].includes(err.status)) throw err;
    }
  }
  throw new StoreError("A biblioteca está ocupada. Tente novamente.", 409);
}
export async function mediaLocation(file: string): Promise<string> {
  if (!/^media\/(images|videos|audio)\/\d{4}-\d{2}\/[a-f0-9-]+-\d+\.[a-z0-9]+$/.test(file)) throw new StoreError("Arquivo não encontrado.", 404);
  const result = await github<{ download_url: string | null }>(`/contents/${file}?ref=${storageConfig().branch}`);
  if (!result.download_url || new URL(result.download_url).hostname !== "raw.githubusercontent.com") throw new StoreError("O GitHub não disponibilizou o arquivo.");
  return result.download_url;
}
