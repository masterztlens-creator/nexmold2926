import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTextEvidence,
} from "../../../.v8-build/src/v8/acquisition/source-extractor.js";

const MAX_EXCERPT_LENGTH = 2_000;

function createLongArticle() {
  const sentences = Array.from(
    { length: 240 },
    (_, index) =>
      `Sentence ${String(index + 1).padStart(3, "0")} records an authoritative injection molding fact.`,
  );

  return {
    sentences,
    html: `<main><article><p>${sentences.join(" ")}</p></article></main>`,
  };
}

test("V8-22B-S3 preserves all sentences in long text evidence", () => {
  const { sentences, html } = createLongArticle();

  const result = extractTextEvidence(html);

  assert.ok(
    result.length > 1,
    "long source text must be split into multiple evidence excerpts",
  );

  for (const sentence of sentences) {
    assert.ok(
      result.some((candidate) => candidate.excerpt.includes(sentence)),
      `complete source sentence must be preserved: ${sentence}`,
    );
  }
});

test("V8-22B-S3 keeps every long-text evidence excerpt within the length limit", () => {
  const { html } = createLongArticle();

  const result = extractTextEvidence(html);

  assert.ok(result.length > 1);

  for (const candidate of result) {
    assert.ok(
      candidate.excerpt.length <= MAX_EXCERPT_LENGTH,
      `excerpt length ${candidate.excerpt.length} exceeds ${MAX_EXCERPT_LENGTH}`,
    );
  }
});

test("V8-22B-S3 does not end long-text excerpts in the middle of a sentence", () => {
  const { html } = createLongArticle();

  const result = extractTextEvidence(html);

  assert.ok(result.length > 1);

  for (const candidate of result) {
    assert.match(
      candidate.excerpt.trim(),
      /[.!?]["')\]]?$/,
      `excerpt must end at a sentence boundary: ${candidate.excerpt.slice(-100)}`,
    );
  }
});

test("V8-22B-S3 long-text extraction is deterministic", () => {
  const { html } = createLongArticle();

  const first = extractTextEvidence(html);
  const second = extractTextEvidence(html);
  const third = extractTextEvidence(html);

  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});