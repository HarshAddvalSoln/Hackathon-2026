import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline returns extraction reports with confidence score", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-5001",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "hash-5001",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
          UHID: HSP-5001
          Final Diagnosis: Viral Fever
        `
      }
    ]
  });

  assert.equal(output.extractionReports.length, 1);
  assert.equal(output.extractionReports[0].status, "pass");
  assert.equal(output.extractionReports[0].confidenceScore, 1);
});

test("pipeline flags low confidence when required fields are missing", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-5002",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "hash-5002",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
        `
      }
    ]
  });

  assert.equal(output.extractionReports.length, 1);
  assert.equal(output.extractionReports[0].status, "warning");
  assert.equal(output.extractionReports[0].lowConfidence, true);
  assert.ok(output.extractionReports[0].confidenceScore < 0.7);
});
