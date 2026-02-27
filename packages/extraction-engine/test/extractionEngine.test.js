import test from "node:test";
import assert from "node:assert/strict";
import { createExtractionEngine } from "../src/index.js";

test("uses digital adapter when document has text layer", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract(document) {
        return { text: `digital:${document.fileName}`, mode: "digital" };
      }
    },
    ocrAdapter: {
      async extract(document) {
        return { text: `ocr:${document.fileName}`, mode: "ocr" };
      }
    }
  });

  const result = await engine.extract({
    fileName: "discharge-summary.pdf",
    hasTextLayer: true
  });

  assert.equal(result.mode, "digital");
  assert.equal(result.text, "digital:discharge-summary.pdf");
});

test("uses OCR adapter when document lacks text layer", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract(document) {
        return { text: `digital:${document.fileName}`, mode: "digital" };
      }
    },
    ocrAdapter: {
      async extract(document) {
        return { text: `ocr:${document.fileName}`, mode: "ocr" };
      }
    }
  });

  const result = await engine.extract({
    fileName: "lab-report-scan.pdf",
    hasTextLayer: false
  });

  assert.equal(result.mode, "ocr");
  assert.equal(result.text, "ocr:lab-report-scan.pdf");
});

test("falls back to OCR when digital extraction returns empty text", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract() {
        return { text: "   ", mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract(document) {
        return { text: `ocr:${document.fileName}`, mode: "ocr_worker" };
      }
    }
  });

  const result = await engine.extract({
    fileName: "scan-only.pdf"
  });

  assert.equal(result.mode, "ocr_worker");
  assert.equal(result.text, "ocr:scan-only.pdf");
});

test("uses OCR for all PDFs when ocrForAllPdfs is enabled", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract(document) {
        return { text: `digital:${document.fileName}`, mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract(document) {
        return { text: `ocr:${document.fileName}`, mode: "ocr_worker" };
      }
    },
    ocrForAllPdfs: true
  });

  const result = await engine.extract({
    fileName: "all-ocr.pdf",
    filePath: "/tmp/all-ocr.pdf",
    hasTextLayer: true
  });

  assert.equal(result.mode, "ocr_worker");
  assert.equal(result.text, "ocr:all-ocr.pdf");
});

test("falls back to digital adapter when OCR-first mode returns empty text", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract(document) {
        return { text: `digital:${document.fileName}`, mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract() {
        return { text: "   ", mode: "ocr_worker" };
      }
    },
    ocrForAllPdfs: true
  });

  const result = await engine.extract({
    fileName: "ocr-empty.pdf",
    filePath: "/tmp/ocr-empty.pdf"
  });

  assert.equal(result.mode, "digital_pdfjs");
  assert.equal(result.text, "digital:ocr-empty.pdf");
  assert.equal(result.metadata.fallback.reason, "ocr_empty_text");
});

test("returns extraction_empty when OCR-first and digital both return empty text", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract() {
        return { text: "", mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract() {
        return { text: "", mode: "ocr_worker", metadata: { diagnostics: { errors: ["ocr-failed"] } } };
      }
    },
    ocrForAllPdfs: true
  });

  const result = await engine.extract({
    fileName: "all-empty.pdf",
    filePath: "/tmp/all-empty.pdf"
  });

  assert.equal(result.mode, "extraction_empty");
  assert.equal(result.metadata.reason, "no_text_from_ocr_or_digital");
  assert.equal(result.metadata.attempts.length, 2);
});

test("returns extraction_failed when OCR backend is unreachable and no digital fallback text exists", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract() {
        return { text: "", mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract() {
        return {
          text: "",
          mode: "ocr_worker",
          metadata: {
            diagnostics: {
              errors: [{ stage: "ocr_backend_unreachable", message: "fetch failed" }]
            }
          }
        };
      }
    },
    ocrForAllPdfs: true
  });

  const result = await engine.extract({
    fileName: "scan.pdf",
    filePath: "/tmp/scan.pdf"
  });

  assert.equal(result.mode, "extraction_failed");
  assert.equal(result.metadata.reason, "ocr_backend_unreachable_no_text_fallback");
  assert.equal(result.metadata.fatal, true);
});

test("returns extraction_failed for scan-only hint when OCR backend is unreachable", async () => {
  const engine = createExtractionEngine({
    digitalAdapter: {
      async extract() {
        return { text: "ignored", mode: "digital_pdfjs" };
      }
    },
    ocrAdapter: {
      async extract() {
        return {
          text: "",
          mode: "ocr_worker",
          metadata: {
            diagnostics: {
              errors: [{ stage: "ocr_backend_unreachable", message: "fetch failed" }]
            }
          }
        };
      }
    }
  });

  const result = await engine.extract({
    fileName: "scan.pdf",
    filePath: "/tmp/scan.pdf",
    hasTextLayer: false
  });

  assert.equal(result.mode, "extraction_failed");
  assert.equal(result.metadata.reason, "scan_requires_ocr_backend_unreachable");
});
