import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";
import { createExtractionEngine } from "../../extraction-engine/src/index.js";

test("pipeline uses extraction engine when text is not provided", async () => {
  const extractionEngine = createExtractionEngine({
    digitalAdapter: {
      async extract(document) {
        return {
          text: `DISCHARGE SUMMARY
Patient Name: Raj Mehta
UHID: HSP-9100
Final Diagnosis: Viral Fever`,
          mode: "digital"
        };
      }
    },
    ocrAdapter: {
      async extract(document) {
        return { text: "", mode: "ocr" };
      }
    }
  });

  const output = await convertClaimDocuments({
    claimId: "CLM-9100",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "hash-9100",
        hasTextLayer: true
      }
    ],
    extractionEngine
  });

  assert.equal(output.classifications[0].hiType, "discharge_summary");
  assert.equal(output.extractionReports[0].status, "pass");
  assert.equal(output.extractionReports[0].sourceMode, "digital");
});

test("pipeline marks low confidence when extracted text is empty", async () => {
  const extractionEngine = createExtractionEngine({
    digitalAdapter: {
      async extract() {
        return { text: "", mode: "digital" };
      }
    },
    ocrAdapter: {
      async extract() {
        return { text: "", mode: "ocr" };
      }
    }
  });

  const output = await convertClaimDocuments({
    claimId: "CLM-9101",
    hospitalId: "default",
    documents: [
      {
        fileName: "blank-scan.pdf",
        sha256: "hash-9101"
      }
    ],
    extractionEngine
  });

  assert.equal(output.classifications[0].hiType, "unknown");
  assert.equal(output.extractionReports[0].lowConfidence, true);
  assert.equal(output.extractionReports[0].sourceMode, "extraction_empty");
  assert.equal(output.extractionReports[0].textLength, 0);
  assert.equal(
    output.extractionReports[0].extractionDiagnostics.reason,
    "no_text_from_digital_or_ocr"
  );
  assert.ok(output.auditLog.some((entry) => entry.action === "extraction_empty"));
});
