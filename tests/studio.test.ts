import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { emptyState, mutate, readState, deleteGeneration, spendSince } from "../lib/db";
import { mediaLocation, transaction } from "../lib/github";
import { runWorker, downloadMedia, MAX_MEDIA_BYTES } from "../lib/worker";
import { createSession, validSession } from "../lib/auth";
import { proxy } from "../proxy";
import { NextRequest } from "next/server";
import { POST as generate } from "../app/api/generate/route";
import { POST as videoQuote } from "../app/api/video/quote/route";
import { POST as settings } from "../app/api/settings/route";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };
let serial: number;
let head: string;
let submissions: number;
let ambiguous: boolean;
let failSave: boolean;
let conflict: boolean;
let blobs: Map<string, Buffer>;
let trees: Map<string, Record<string,string>>;
let commits: Map<string, { tree: { sha: string }; parents: string[] }>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type":"application/json" } });
function identifier() { return String(++serial).padStart(40,"0"); }
function stateAt(commit = head) {
  const tree = trees.get(commits.get(commit)!.tree.sha)!;
  const sha = tree[".studio/state.json"];
  return sha ? JSON.parse(blobs.get(sha)!.toString()) : emptyState();
}
function seed(state: ReturnType<typeof emptyState>) {
  const blob = identifier(); blobs.set(blob, Buffer.from(JSON.stringify(state)));
  const tree = identifier(); trees.set(tree, { ...trees.get(commits.get(head)!.tree.sha), ".studio/state.json": blob });
  const commit = identifier(); commits.set(commit, { tree: { sha: tree }, parents: [head] }); head = commit;
}

beforeEach(() => {
  Object.assign(process.env, { GITHUB_REPOSITORY: "example/studio", GITHUB_TOKEN: "test-token-not-real", HF_API_KEY_ID: "test-id", HF_API_KEY_SECRET: "test-secret",
    APP_PASSWORD: "test-only-password-at-least-16", SESSION_SECRET: "test-only-signing-key-at-least-32-characters", CRON_SECRET: "test-only-cron" });
  serial = 0; submissions = 0; ambiguous = false; failSave = false; conflict = false;
  blobs = new Map(); trees = new Map(); commits = new Map();
  const tree = identifier(); trees.set(tree, {}); head = identifier(); commits.set(head,{tree:{sha:tree},parents:[]});
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input)); const method = init.method || "GET";
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (url.hostname === "outputs.example.com") return new Response(new Uint8Array([137,80,78,71,13,10,26,10]), { headers: {"content-type":"image/png"} });
    if (url.hostname === "api.higgsfield.ai") {
      if (url.pathname.startsWith("/estimate/")) return json({ usd: "0.10", credits: "1" });
      if (url.pathname.endsWith("/status")) return json({ request_id: "request-1", status: "completed", images: [{ url: "https://outputs.example.com/result.png" }] });
      submissions++;
      if (ambiguous) throw new TypeError("Network connection lost after submission");
      return json({ request_id:"request-1", status:"queued" });
    }
    assert.equal(url.hostname,"api.github.com");
    const path = url.pathname.replace("/repos/example/studio", "");
    if (path.startsWith("/git/ref/heads/")) return json({object:{sha:head}});
    if (path.startsWith("/contents/.studio/state.json")) {
      const state = stateAt(url.searchParams.get("ref") || head);
      const tree = trees.get(commits.get(url.searchParams.get("ref") || head)!.tree.sha)!;
      return tree[".studio/state.json"] ? json(state) : json({},404);
    }
    if (path.startsWith("/contents/media/")) return json({download_url: "https://raw.githubusercontent.com/example/studio/temporary/result.png"});
    if (path === "/git/blobs") { const sha=identifier(); blobs.set(sha,Buffer.from(body.content,"base64")); return json({sha}); }
    if (path === "/git/trees") {
      const tree = {...trees.get(body.base_tree)};
      for (const file of body.tree) { if (file.sha === null) delete tree[file.path]; else tree[file.path]=file.sha; }
      const sha=identifier(); trees.set(sha,tree); return json({sha});
    }
    if (path === "/git/commits" && method === "POST") {
      const sha=identifier(); commits.set(sha,{tree:{sha:body.tree},parents:body.parents}); return json({sha});
    }
    if (path.startsWith("/git/commits/")) return json(commits.get(path.split("/").pop()!));
    if (path.startsWith("/git/refs/heads/") && method === "PATCH") {
      assert.equal(body.force,false);
      if (conflict) { conflict=false; const state=stateAt(); state.settings.spend_cap="42"; seed(state); return json({},422); }
      if (failSave && stateAt(body.sha).jobs.some((j: { request_id: string }) => j.request_id)) { failSave=false; return json({},503); }
      if (commits.get(body.sha)!.parents[0] !== head) return json({},422);
      head=body.sha; return json({object:{sha:head}});
    }
    throw new Error(`Unexpected mock operation: ${method} ${path}`);
  };
});
afterEach(() => { global.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); });

async function createJob() {
  const response = await generate(new Request("http://localhost/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({modelId:"soul-cinema",prompt:"Uma paisagem brasileira ao amanhecer",params:{},batch:1}) }));
  assert.equal(response.status,200,await response.clone().text());
  return (await response.json()).id as string;
}

test("full workflow: generate, poll, save bytes and metadata atomically, read back, delete media preserving costs", async () => {
  const id=await createJob();
  await runWorker(); assert.equal(submissions,1);
  await mutate(s=>{s.jobs[0].next_poll_at=0;});
  await runWorker(); assert.equal((await readState()).jobs[0].status,"downloading");
  await runWorker();
  const job=(await readState()).jobs[0]; assert.equal(job.status,"completed"); assert.equal(job.id,id);
  const file=job.outputs[0].local_path!; assert.match(file,/^media\/images\//);
  const tree=trees.get(commits.get(head)!.tree.sha)!;
  assert.deepEqual(blobs.get(tree[file]),Buffer.from([137,80,78,71,13,10,26,10]));
  assert.match(await mediaLocation(file),/^https:\/\/raw\.githubusercontent\.com\//);
  await runWorker(); assert.equal(submissions,1);
  await deleteGeneration(job.outputs[0].id);
  const state=await readState(); assert.equal(state.jobs[0].outputs.length,0);
  assert.equal(spendSince(0,state.jobs).usd,0.1);
  assert.equal(trees.get(commits.get(head)!.tree.sha)![file],undefined);
});

test("CAS conflict preserves another writer's changes", async()=>{
  conflict=true;
  await mutate(s=>{s.settings.max_concurrent=7;});
  const state=await readState(); assert.equal(state.settings.max_concurrent,7); assert.equal(state.settings.spend_cap,"42");
});

test("two workers never submit the same pending job twice",async()=>{
  await createJob(); await Promise.all([runWorker(),runWorker()]); assert.equal(submissions,1);
});

test("ambiguous provider submission is never retried automatically",async()=>{
  await createJob(); ambiguous=true;
  await runWorker(); await runWorker();
  assert.equal(submissions,1); const job=(await readState()).jobs[0]; assert.equal(job.status,"failed"); assert.match(job.error!,/cobrança duplicada/);
});

test("lost persistence after provider accepts does not resubmit after restart",async()=>{
  await createJob(); failSave=true;
  await assert.rejects(runWorker()); await runWorker();
  assert.equal(submissions,1); assert.equal((await readState()).jobs[0].status,"failed");
});

test("active lease prevents simultaneous removal",async()=>{
  await createJob(); await runWorker(); await mutate(s=>{s.jobs[0].next_poll_at=0;}); await runWorker(); await runWorker();
  const gen=(await readState()).jobs[0].outputs[0];
  await mutate(s=>{s.lease={owner:"other-worker",until:Date.now()+60000};});
  await assert.rejects(deleteGeneration(gen.id),/sincronizada/);
});

test("budget includes concurrent pending requests",async()=>{
  await mutate(s=>{s.settings.spend_cap="0.10";}); await createJob();
  const response=await generate(new Request("http://localhost/api/generate",{method:"POST",body:JSON.stringify({modelId:"soul-cinema",prompt:"Outra paisagem"})}));
  assert.equal(response.status,402); assert.equal((await readState()).jobs.length,1);
});

test("settings rejects credentials instead of committing them",async()=>{
  const response=await settings(new Request("http://localhost/api/settings",{method:"POST",body:JSON.stringify({keySecret:"must-never-be-stored"})}));
  assert.equal(response.status,400); assert.equal(blobs.size,0);
});

test("private media path rejects traversal and arbitrary repository files",async()=>{
  await assert.rejects(mediaLocation("../.env")); await assert.rejects(mediaLocation(".studio/state.json"));
});

test("download enforces actual byte limit and rejects unsupported URLs",async()=>{
  await assert.rejects(downloadMedia("http://localhost/secret"));
  global.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_MEDIA_BYTES+1));c.close();}}),{headers:{"content-type":"video/mp4"}});
  await assert.rejects(downloadMedia("https://outputs.example.com/big.mp4"),/40 MB/);
});

test("sessions reject tampering, rotation and missing configuration",()=>{
  const cookie=createSession(); assert.ok(validSession(cookie)); assert.ok(!validSession(cookie+"x"));
  process.env.APP_PASSWORD="a-different-long-password"; assert.ok(!validSession(cookie));
  delete process.env.SESSION_SECRET; assert.ok(!validSession(cookie)); assert.throws(createSession);
});

test("proxy requires login, protects cron and rejects cross-origin mutations",()=>{
  assert.equal(proxy(new NextRequest("http://localhost/api/jobs")).status,401);
  assert.equal(proxy(new NextRequest("http://localhost/library")).status,307);
  assert.equal(proxy(new NextRequest("http://localhost/api/cron")).status,401);
  assert.equal(proxy(new NextRequest("http://localhost/api/cron",{headers:{authorization:"Bearer test-only-cron"}})).status,200);
  assert.equal(proxy(new NextRequest("http://localhost/api/generate",{method:"POST",headers:{origin:"https://evil.example",cookie:`studio_session=${createSession()}`}})).status,403);
  assert.equal(proxy(new NextRequest("http://localhost/api/jobs",{headers:{cookie:`studio_session=${createSession()}`}})).status,200);
});

test("same-origin login works behind Next's internal localhost URL",()=>{
  const request=new NextRequest("http://localhost:3000/api/auth/login",{method:"POST",headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"}});
  assert.equal(proxy(request).status,200);
});

test("short personal password can log in and create a valid session; empty password stays unconfigured",async()=>{
  const { POST: login } = await import("../app/api/auth/login/route");
  process.env.APP_PASSWORD="1234";
  const response=await login(new Request("http://localhost/api/auth/login",{method:"POST",body:JSON.stringify({password:"1234"})}));
  assert.equal(response.status,200);
  const session=response.cookies.get("studio_session")?.value;
  assert.ok(validSession(session));
  process.env.APP_PASSWORD="";
  const empty=await login(new Request("http://localhost/api/auth/login",{method:"POST",body:JSON.stringify({password:""})}));
  assert.equal(empty.status,503);
  assert.ok(!validSession(session));
});

test("complete Higgsfield key is sent verbatim and takes precedence over legacy credentials",async()=>{
  const { credentials, estimate } = await import("../lib/higgsfield");
  process.env.HF_KEY="test-complete-key:secret-part";
  assert.equal(credentials(),"test-complete-key:secret-part");
  global.fetch=async(_input,init)=>{
    assert.equal(new Headers(init?.headers).get("authorization"),"Key test-complete-key:secret-part");
    return json({usd:"0.10",credits:"1"});
  };
  await estimate("/test/model",{});
});

test("official and legacy Higgsfield pairs work without mixing incomplete credentials",async()=>{
  const { credentials } = await import("../lib/higgsfield");
  delete process.env.HF_KEY;
  process.env.HF_API_KEY="official-id";
  process.env.HF_API_SECRET="official-secret";
  assert.equal(credentials(),"official-id:official-secret");
  delete process.env.HF_API_SECRET;
  assert.equal(credentials(),"test-id:test-secret");
  delete process.env.HF_API_KEY_ID;
  assert.equal(credentials(),null);
});

test("Genjutsu queues its exact mixed input and persists completed video in the GitHub library", async () => {
  const fallback = global.fetch;
  const input = { prompt: "", video_url: "https://media.example.com/motion.mp4", image_urls: ["https://media.example.com/character.jpg"], resolution: "1080p" };
  const videoBytes = Buffer.from("mock-mp4-result");
  let sent = 0;
  global.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    if (parsed.hostname === "api.higgsfield.ai" && parsed.pathname.endsWith("/higgsfield/genjutsu/motion-transfer/v1.0")) {
      assert.deepEqual(JSON.parse(String(init?.body)), input);
      if (parsed.pathname.startsWith("/estimate/")) return json({ usd: "6.528", credits: "1" });
      sent++;
      return json({ request_id: "genjutsu-1", status: "queued" });
    }
    if (parsed.pathname === "/requests/genjutsu-1/status") return json({ request_id: "genjutsu-1", status: "completed", video: { url: "https://outputs.example.com/result.mp4" } });
    if (parsed.href === "https://outputs.example.com/result.mp4") return new Response(videoBytes, { headers: { "content-type": "video/mp4" } });
    return fallback(url, init);
  };
  const request = { modelId: "genjutsu-motion-transfer", videoUrl: input.video_url, refUrls: input.image_urls, params: { resolution: "1080p" } };
  const quotation = await videoQuote(new Request("http://localhost/api/video/quote", { method: "POST", body: JSON.stringify(request) }));
  const quote = await quotation.json();
  const response = await generate(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify({
    ...request, confirmation: quote.confirmation, balanceAcknowledged: true
  }) }));
  assert.equal(response.status, 200, await response.clone().text());
  await runWorker();
  await mutate(s => { s.jobs[0].next_poll_at = 0; });
  await runWorker();
  await runWorker();
  const job = (await readState()).jobs[0];
  assert.equal(job.status, "completed");
  assert.equal(job.model_name, "Genjutsu Motion Transfer");
  assert.deepEqual(job.params, input);
  assert.equal(job.outputs[0].kind, "video");
  const file = job.outputs[0].local_path!;
  assert.match(file, /^media\/videos\/.*\.mp4$/);
  assert.deepEqual(blobs.get(trees.get(commits.get(head)!.tree.sha)![file]), videoBytes);
  await runWorker();
  assert.equal(sent, 1);
});

test("missing Genjutsu estimate endpoint does not incorrectly disable documented generation", async () => {
  const { POST: quote } = await import("../app/api/estimate/route");
  global.fetch = async () => json({ detail: "Not found" }, 404);
  const response = await quote(new Request("http://localhost/api/estimate", { method: "POST", body: JSON.stringify({
    modelId: "genjutsu-motion-transfer", videoUrl: "https://media.example.com/video.mp4", refUrls: ["https://media.example.com/image.jpg"]
  }) }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.usd, null);
  assert.notEqual(body.available, false);
});


const videoInput = { modelId: "genjutsu-motion-transfer", videoUrl: "https://media.example.com/motion.mp4", refUrls: ["https://media.example.com/character.jpg"], params: { resolution: "720p" } };
async function quoteRequest(input: unknown = videoInput) {
  return videoQuote(new Request("http://localhost/api/video/quote", { method: "POST", body: JSON.stringify(input) }));
}
async function generateVideo(extra: Record<string, unknown>) {
  return generate(new Request("http://localhost/api/generate", { method: "POST", body: JSON.stringify({ ...videoInput, ...extra }) }));
}

test("video generation requires signed matching confirmation and acknowledgment of unavailable balance", async () => {
  assert.equal((await generateVideo({})).status, 409);
  const quote = await (await quoteRequest()).json();
  assert.equal(quote.usd, 0.1); assert.equal(quote.credits, 1);
  assert.equal(quote.balance.status, "unavailable"); assert.equal(quote.remainingUsd, null);
  assert.equal((await generateVideo({ confirmation: quote.confirmation })).status, 409);
  assert.equal((await generateVideo({ confirmation: quote.confirmation + "x", balanceAcknowledged: true })).status, 409);
  assert.equal((await generateVideo({ confirmation: quote.confirmation, balanceAcknowledged: true, params: { resolution: "1080p" } })).status, 409);
  assert.equal((await readState()).jobs.length, 0);
  assert.equal(submissions, 0);
});

test("video price is recalculated before enqueue and price changes require a new confirmation", async () => {
  const quote = await (await quoteRequest()).json();
  const fallback = global.fetch;
  global.fetch = async (url, init) => new URL(String(url)).pathname.startsWith("/estimate/") ? json({ usd: "0.50", credits: "5" }) : fallback(url, init);
  const response = await generateVideo({ confirmation: quote.confirmation, balanceAcknowledged: true });
  assert.equal(response.status, 409);
  assert.equal((await readState()).jobs.length, 0);
  assert.equal(submissions, 0);
});

test("replayed video confirmation produces one durable job", async () => {
  const quote = await (await quoteRequest()).json();
  const request = { confirmation: quote.confirmation, balanceAcknowledged: true };
  const [a, b] = await Promise.all([generateVideo(request), generateVideo(request)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal((await a.json()).id, (await b.json()).id);
  assert.equal((await readState()).jobs.length, 1);
});

test("worker never submits an approved video whose quote changed while waiting in the queue", async () => {
  const quote = await (await quoteRequest()).json();
  assert.equal((await generateVideo({ confirmation: quote.confirmation, balanceAcknowledged: true })).status, 200);
  const fallback = global.fetch;
  global.fetch = async (url, init) => new URL(String(url)).pathname.startsWith("/estimate/") ? json({ usd: "0.40", credits: "4" }) : fallback(url, init);
  await runWorker();
  assert.equal(submissions, 0);
  const job = (await readState()).jobs[0];
  assert.equal(job.status, "failed"); assert.match(job.error!, /preço mudou/);
});

test("unknown price never becomes zero and has no usable confirmation", async () => {
  global.fetch = async () => json({ usd: null, credits: "" });
  const quote = await (await quoteRequest()).json();
  assert.equal(quote.usd, null); assert.equal(quote.credits, null); assert.equal(quote.confirmation, null);
  assert.equal(quote.source, "unavailable"); assert.equal(quote.remainingUsd, null);
});

test("official Genjutsu table rates use server-verified media duration only", async () => {
  const { videoProof } = await import("../lib/video-metadata");
  global.fetch = async () => json({ detail: "Missing estimate" }, 404);
  const proof = videoProof(videoInput.videoUrl, { duration: 4.1 });
  const quote = await (await quoteRequest({ ...videoInput, videoMetadata: proof })).json();
  assert.equal(quote.usd, 3.405); assert.equal(quote.credits, null); assert.equal(quote.source, "configured-rate");
  const untrusted = await (await quoteRequest({ ...videoInput, sourceDuration: 4.1, videoMetadata: proof + "tampered" })).json();
  assert.equal(untrusted.usd, null); assert.equal(untrusted.confirmation, null);
});

test("provider insufficient balance and invalid combinations cannot receive confirmation", async () => {
  global.fetch = async () => json({ detail: "insufficient balance" }, 402);
  assert.equal((await quoteRequest()).status, 402);
  global.fetch = async () => json({ detail: "unsupported combination" }, 422);
  assert.equal((await quoteRequest()).status, 422);
  assert.equal(submissions, 0);
});

test("token price descriptions do not invent token counts or dollar conversions", async () => {
  global.fetch = async () => json({ type: "description", pricing_description: "Billed per token" });
  const quote = await (await quoteRequest({ modelId: "bytedance-seedance-2-5-text-to-video", prompt: "Ocean" })).json();
  assert.equal(quote.billingUnit, "tokens");
  assert.equal(quote.tokens, null); assert.equal(quote.usd, null); assert.equal(quote.confirmation, null);
});
