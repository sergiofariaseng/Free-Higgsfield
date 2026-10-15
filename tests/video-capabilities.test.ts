import { test } from "node:test";
import assert from "node:assert/strict";
import { durationOptions } from "../lib/video-capabilities";
import { parseGenerationRequest } from "../lib/payload";
import { balanceAfter } from "../lib/api-balance";
import { realAmount, confirmedVideo, quoteVideo } from "../lib/video-pricing";
import { mp4Metadata, videoProof, verifiedVideoMetadata } from "../lib/video-metadata";
import { readSignedData, signData } from "../lib/signed-data";

test("model-supported durations, ratios and resolutions are enforced on the server", () => {
  const input = { modelId: "alibaba-happy-horse-text-to-video", prompt: "A cinematic landscape" };
  for (const params of [{ duration: 30 }, { duration: 3.5 }, { aspect_ratio: "4:5" }, { resolution: "480p" }]) {
    assert.throws(() => parseGenerationRequest({ ...input, params }), /não suportado/);
  }
  assert.equal(parseGenerationRequest({ ...input, params: { duration: 10, aspect_ratio: "9:16", resolution: "1080p" } }).body.duration, 10);
  assert.deepEqual(durationOptions({ key: "duration", label: "Duration", type: "enum", options: [5, 10] }), [5, 10]);
  assert.deepEqual(durationOptions({ key: "duration", label: "Duration", type: "int", min: 3, max: 6 }), [3, 4, 5, 6]);
});

test("balance arithmetic uses actual matching units, including zero and insufficient balance", () => {
  const balance = { status: "available" as const, usd: 10, credits: 100, checkedAt: 0 };
  assert.deepEqual(balanceAfter(balance, 3, 5), { remainingUsd: 7, remainingCredits: 95, insufficient: false });
  assert.equal(balanceAfter(balance, 11, 5).insufficient, true);
  assert.equal(balanceAfter(balance, 3, 101).insufficient, true);
  assert.equal(balanceAfter({ ...balance, usd: 0 }, 0.01, null).insufficient, true);
  assert.deepEqual(balanceAfter({ ...balance, status: "unavailable" }, 3, 5), { remainingUsd: null, remainingCredits: null, insufficient: false });
  assert.equal(balanceAfter({ ...balance, usd: null }, 3, null).remainingUsd, null);
  for (const value of [null, undefined, "", " ", false, NaN, Infinity, -1]) assert.equal(realAmount(value), null);
  assert.equal(realAmount("0"), 0);
});

function mp4(seconds: number, version = 0) {
  const mvhd = Buffer.alloc(version ? 40 : 28);
  mvhd.writeUInt32BE(mvhd.length); mvhd.write("mvhd", 4); mvhd[8] = version;
  mvhd.writeUInt32BE(1000, version ? 28 : 20);
  if (version) mvhd.writeBigUInt64BE(BigInt(seconds * 1000), 32);
  else mvhd.writeUInt32BE(seconds * 1000, 24);
  const moov = Buffer.alloc(8); moov.writeUInt32BE(mvhd.length + 8); moov.write("moov", 4);
  const bytes = Buffer.concat([moov, mvhd]);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test("bounded MP4 parser handles v0/v1 movie headers and rejects truncated or malformed files", () => {
  assert.deepEqual(mp4Metadata(mp4(4.1)), { duration: 4.1 });
  assert.deepEqual(mp4Metadata(mp4(45, 1)), { duration: 45 });
  assert.equal(mp4Metadata(mp4(4).slice(0, 20)), null);
  assert.equal(mp4Metadata(new ArrayBuffer(10)), null);
});

test("server media proof is URL-bound, tamper-proof and expires", () => {
  process.env.SESSION_SECRET = "test-signing-secret-longer-than-32-characters";
  const url = "https://media.example.com/a.mp4";
  const proof = videoProof(url, { duration: 4.2 });
  assert.equal(verifiedVideoMetadata(url, proof)?.duration, 4.2);
  assert.equal(verifiedVideoMetadata(url + "?other", proof), null);
  assert.equal(verifiedVideoMetadata(url, proof + "a"), null);
  const expired = signData("video-metadata", { url, duration: 4.2, expires: 0 });
  assert.equal(verifiedVideoMetadata(url, expired), null);
  assert.equal(readSignedData("video-quote", proof), null);
});

test("expired confirmations cannot be used even with a valid signature", async () => {
  process.env.SESSION_SECRET = "test-signing-secret-longer-than-32-characters";
  process.env.HF_KEY = "test-key:test-secret";
  const original = global.fetch;
  try {
    global.fetch = async () => new Response(JSON.stringify({ usd: "1", credits: "2" }));
    const request = parseGenerationRequest({ modelId: "alibaba-happy-horse-text-to-video", prompt: "Ocean" });
    const quote = await quoteVideo(request);
    const signed = readSignedData<Record<string, unknown>>("video-quote", quote.confirmation)!;
    assert.throws(() => confirmedVideo(request, signData("video-quote", { ...signed, expires: 0 })), /expirou/);
    assert.throws(() => confirmedVideo({ ...request, prompt: "Changed", body: { ...request.body, prompt: "Changed" } }, quote.confirmation), /configurações mudaram/);
  } finally { global.fetch = original; }
});
