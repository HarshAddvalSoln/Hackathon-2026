import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline uses sourceMode=missing when no text and no extraction engine", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-EDGE-1",
    documents: [{ fileName: "x.pdf", sha256: "hash-x" }]
  });

  assert.equal(output.extractionReports[0].sourceMode, "missing");
  assert.equal(output.extractionReports[0].lowConfidence, true);
});

test("pipeline propagates extraction engine failures", async () => {
  const extractionEngine = {
    async extract() {
      throw new Error("engine failed");
    }
  };

  await assert.rejects(
    () =>
      convertClaimDocuments({
        claimId: "CLM-EDGE-2",
        documents: [{ fileName: "x.pdf", sha256: "hash-x" }],
        extractionEngine
      }),
    /engine failed/
  );
});

test("pipeline fails fast on extraction_failed mode from extraction engine", async () => {
  const extractionEngine = {
    async extract() {
      return {
        text: "",
        mode: "extraction_failed",
        metadata: {
          reason: "ocr_backend_unreachable_no_text_fallback",
          fatal: true
        }
      };
    }
  };

  await assert.rejects(
    () =>
      convertClaimDocuments({
        claimId: "CLM-EDGE-2B",
        documents: [{ fileName: "scan.pdf" }],
        extractionEngine
      }),
    /document_extraction_failed:ocr_backend_unreachable_no_text_fallback/
  );
});

test("pipeline defaults hospitalId and templateId", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-EDGE-3",
    documents: [
      {
        fileName: "discharge.pdf",
        sha256: "h",
        text: "DISCHARGE SUMMARY\nPatient Name: A\nUHID: X\nFinal Diagnosis: Y"
      }
    ]
  });

  assert.equal(output.hospitalId, "default");
  assert.equal(output.templateId, "default");
});

test("pipeline does not treat OCR placeholder demographics as valid", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-EDGE-4",
    documents: [
      {
        fileName: "lab.pdf",
        text: `
          DIAGNOSTIC REPORT
          Patient Name : MR. Age : 58 Gender : Male
          Patient ID : Age
          Patient|D : B/1181
          Report Date : 30-10-2024
          B. Urea 273.6 mg/dl 13 - 45
        `
      }
    ]
  });

  assert.equal(output.extractionReports[0].extracted.patientName, null);
  assert.equal(output.extractionReports[0].extracted.patientLocalId, "B/1181");
  assert.equal(output.qualityReports[0].status, "warning");
  assert.equal(output.validationReport.status, "pass");
  assert.equal(output.complianceReport.overallStatus, "pass");
});
