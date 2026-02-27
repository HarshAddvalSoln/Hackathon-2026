import test from "node:test";
import assert from "node:assert/strict";
import { createPdfjsAdapter } from "../src/adapters/pdfjsAdapter.js";
import { createOcrAdapter } from "../src/adapters/ocrAdapter.js";

test("pdfjs adapter returns provided text when available", async () => {
  const adapter = createPdfjsAdapter();
  const result = await adapter.extract({
    fileName: "doc.pdf",
    text: "DISCHARGE SUMMARY"
  });

  assert.equal(result.mode, "digital");
  assert.equal(result.text, "DISCHARGE SUMMARY");
});

test("pdfjs adapter extracts text from pdfjs token stream", async () => {
  const adapter = createPdfjsAdapter({
    readFile: async () => Buffer.from([1, 2, 3]),
    pdfjsLib: {
      getDocument() {
        return {
          promise: Promise.resolve({
            numPages: 1,
            async getPage() {
              return {
                async getTextContent() {
                  return {
                    items: [{ str: "DISCHARGE" }, { str: "SUMMARY" }]
                  };
                }
              };
            }
          })
        };
      }
    }
  });

  const result = await adapter.extract({
    fileName: "doc.pdf",
    filePath: "/tmp/doc.pdf"
  });

  assert.equal(result.mode, "digital_pdfjs");
  assert.equal(result.text, "DISCHARGE SUMMARY");
});

test("pdfjs adapter supports base64Pdf input", async () => {
  const adapter = createPdfjsAdapter({
    pdfjsLib: {
      getDocument() {
        return {
          promise: Promise.resolve({
            numPages: 1,
            async getPage() {
              return {
                async getTextContent() {
                  return {
                    items: [{ str: "DIAGNOSTIC" }, { str: "REPORT" }]
                  };
                }
              };
            }
          })
        };
      }
    }
  });

  const result = await adapter.extract({
    fileName: "scan.pdf",
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(result.mode, "digital_pdfjs");
  assert.equal(result.text, "DIAGNOSTIC REPORT");
  assert.equal(result.metadata.source, "base64Pdf");
});

test("ocr adapter uses worker endpoint when available", async () => {
  const adapter = createOcrAdapter({
    workerUrl: "http://localhost:8081",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          text: "OCR CONTENT",
          confidence: 0.88,
          diagnostics: {
            engine: "stub",
            errors: []
          }
        };
      }
    })
  });

  const result = await adapter.extract({
    fileName: "scan.pdf",
    filePath: "/tmp/scan.pdf"
  });

  assert.equal(result.mode, "ocr_worker");
  assert.equal(result.text, "OCR CONTENT");
  assert.equal(result.metadata.confidence, 0.88);
  assert.equal(result.metadata.diagnostics.engine, "stub");
});

test("ocr adapter returns empty text when no ocr input is provided", async () => {
  const adapter = createOcrAdapter();
  const result = await adapter.extract({
    fileName: "scan.pdf"
  });

  assert.equal(result.mode, "ocr_empty");
  assert.equal(result.text, "");
});
