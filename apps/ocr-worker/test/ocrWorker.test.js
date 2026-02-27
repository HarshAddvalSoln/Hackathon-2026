import test from "node:test";
import assert from "node:assert/strict";
import { createOcrWorkerService } from "../src/service.js";

test("OCR worker returns extracted text from engine", async () => {
  const service = createOcrWorkerService({
    ocrEngine: {
      async extract() {
        return {
          text: "OCR TEXT",
          confidence: 0.91,
          diagnostics: {
            engine: "stub",
            errors: []
          }
        };
      }
    }
  });

  const response = await service.handle({
    method: "POST",
    url: "/ocr/extract",
    body: { fileName: "scan.pdf", filePath: "/tmp/scan.pdf" }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.text, "OCR TEXT");
  assert.equal(response.body.confidence, 0.91);
  assert.equal(response.body.diagnostics.engine, "stub");
});

test("OCR worker returns 400 when payload is empty", async () => {
  const service = createOcrWorkerService();
  const response = await service.handle({
    method: "POST",
    url: "/ocr/extract",
    body: {}
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_request");
});
