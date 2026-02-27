import test from "node:test";
import assert from "node:assert/strict";
import { createExtractionEngine } from "../src/index.js";
import { createPdfjsAdapter } from "../src/adapters/pdfjsAdapter.js";
import { createOcrAdapter } from "../src/adapters/ocrAdapter.js";

test("createExtractionEngine throws when adapters are invalid", () => {
  assert.throws(() => createExtractionEngine({ digitalAdapter: null, ocrAdapter: {} }));
});

test("pdfjs adapter returns digital_empty when no text/filePath provided", async () => {
  const adapter = createPdfjsAdapter();
  const result = await adapter.extract({ fileName: "doc.pdf" });
  assert.equal(result.mode, "digital_empty");
  assert.equal(result.text, "");
});

test("ocr adapter throws when worker call fails", async () => {
  const adapter = createOcrAdapter({
    workerUrl: "http://localhost:8081",
    fetchImpl: async () => ({ ok: false, status: 503 })
  });

  await assert.rejects(
    () => adapter.extract({ fileName: "scan.pdf", filePath: "/tmp/scan.pdf" }),
    /OCR worker request failed/
  );
});
