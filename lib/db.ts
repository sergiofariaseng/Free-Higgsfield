import { snapshot, transaction, type TreeChange, StoreError } from "./github";
import type { Job, Generation } from "./shared";
export type { JobStatus } from "./shared";
export const TERMINAL = ["completed", "failed", "nsfw", "canceled"];
export type JobWithOutputs = Job & { next_poll_at: number; submitted_at: number | null; submission_started_at?: number; archived?: boolean };
export interface StudioState {
  version: 1;
  settings: { max_concurrent: number; spend_cap: string };
  jobs: JobWithOutputs[];
  lease?: { owner: string; until: number };
}
export const emptyState = (): StudioState => ({ version: 1, settings: { max_concurrent: 4, spend_cap: "" }, jobs: [] });
export async function readState() {
  const { state } = await snapshot(emptyState);
  if (state.version !== 1 || !Array.isArray(state.jobs)) throw new StoreError("Formato de catálogo incompatível.");
  return state;
}
export function mutate<R>(fn: (state: StudioState) => R, files: TreeChange[] = []) { return transaction(emptyState, fn, files); }
export async function listJobs(opts: { kind?: "image" | "video"; limit?: number } = {}) {
  return (await readState()).jobs.filter(j => !j.archived && (!opts.kind || j.kind === opts.kind))
    .sort((a,b) => b.created_at - a.created_at).slice(0, opts.limit ?? 1000);
}
export async function getJob(id: string) { return (await readState()).jobs.find(j => j.id === id) ?? null; }
export function spendSince(since: number, jobs: Job[]) {
  const completed = jobs.filter(j => j.created_at >= since && j.status === "completed");
  return { usd: completed.reduce((sum,j) => sum + (j.est_usd ?? 0), 0), count: completed.length };
}
export function assertUnlocked(state: StudioState) {
  if (state.lease && state.lease.until > Date.now()) throw new StoreError("Uma geração está sendo sincronizada. Aguarde alguns segundos e tente novamente.", 409);
}
export async function deleteJob(id: string) {
  const job = await getJob(id);
  if (!job) throw new StoreError("Geração não encontrada.", 404);
  if (!TERMINAL.includes(job.status)) throw new StoreError("Cancele a geração antes de removê-la.", 409);
  return mutate(state => {
    assertUnlocked(state);
    const current = state.jobs.find(j => j.id === id);
    if (current) { current.outputs = []; current.archived = true; }
    return { removedFiles: job.outputs.length };
  }, job.outputs.filter(g => g.local_path).map(g => ({ path: g.local_path!, mode: "100644", type: "blob", sha: null })));
}
export async function deleteGeneration(id: string) {
  const jobs = (await readState()).jobs;
  const job = jobs.find(j => j.outputs.some(g => g.id === id));
  const gen = job?.outputs.find(g => g.id === id);
  if (!job || !gen) throw new StoreError("Arquivo não encontrado.", 404);
  return mutate(state => {
    assertUnlocked(state);
    const current = state.jobs.find(j => j.id === job.id);
    if (!current || !TERMINAL.includes(current.status)) throw new StoreError("Aguarde a geração terminar.", 409);
    current.outputs = current.outputs.filter(g => g.id !== id);
    if (!current.outputs.length) current.archived = true;
    return { removedJob: false }; // Preserve cost history after deleting media.
  }, gen.local_path ? [{ path: gen.local_path, mode: "100644", type: "blob", sha: null }] : []);
}
export async function deleteFailedJobs() {
  return mutate(state => {
    assertUnlocked(state);
    const before = state.jobs.length;
    state.jobs = state.jobs.filter(j => !["failed", "nsfw", "canceled"].includes(j.status) || j.outputs.length > 0 || j.submission_started_at);
    return before - state.jobs.length;
  });
}
export type GenerationRow = Generation;
