import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenerationRequest, BadRequest } from "../lib/payload";
import { modelsByKind } from "../lib/models";
import { genjutsuListPrice } from "../lib/genjutsu";

const input = { modelId: "genjutsu-motion-transfer", videoUrl: "https://media.example.com/motion.mp4", refUrls: ["https://media.example.com/character.jpg"] };

test("Genjutsu supports mixed references and optional prompt with exact documented payload", () => {
  assert.ok(modelsByKind("video").some(m => m.id === input.modelId));
  const parsed = parseGenerationRequest({ ...input, batch: 4, params: { seed: 123 } });
  assert.equal(parsed.endpoint, "/higgsfield/genjutsu/motion-transfer/v1.0");
  assert.equal(parsed.batch, 1);
  assert.deepEqual(parsed.body, { prompt: "", video_url: input.videoUrl, image_urls: input.refUrls, resolution: "720p" });
  for (const resolution of ["480p", "720p", "1080p"]) {
    const refs = Array.from({ length: 8 }, (_, i) => `https://media.example.com/${i}.jpg`);
    assert.deepEqual(parseGenerationRequest({ ...input, prompt: " Nova aparência ", refUrls: refs, params: { resolution } }).body,
      { prompt: "Nova aparência", video_url: input.videoUrl, image_urls: refs, resolution });
  }
});

test("Genjutsu rejects incomplete references, invalid URLs, excess images and unsupported options", () => {
  for (const change of [
    { videoUrl: undefined }, { videoUrl: "file:///tmp/video.mp4" }, { videoUrl: "https://user:password@example.com/video.mp4" },
    { refUrls: [] }, { refUrls: ["not a URL"] }, { refUrls: [123] },
    { refUrls: Array(9).fill(input.refUrls[0]) }, { videoUrl: "https://example.com/" + "x".repeat(2083) },
    { params: { duration: 10 } }, { params: { aspect_ratio: "9:16" } }, { params: { resolution: "4K" } }, { prompt: "x".repeat(10001) }
  ]) assert.throws(() => parseGenerationRequest({ ...input, ...change }), BadRequest);
  assert.throws(() => parseGenerationRequest({ modelId: "soul-cinema", prompt: "" }), /descrição/);
});

test("Genjutsu table price rounds input seconds up and caps at prepared 30 seconds", () => {
  assert.equal(genjutsuListPrice(4, "480p"), 1.272);
  assert.equal(genjutsuListPrice(4.01, "720p"), 3.405);
  assert.equal(genjutsuListPrice(45, "1080p"), 48.96);
  assert.equal(genjutsuListPrice(3.99, "720p"), null);
  assert.equal(genjutsuListPrice(Infinity, "720p"), null);
  assert.equal(genjutsuListPrice(10, "4K"), null);
});
