import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline returns validation report with per-bundle results", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-VREP-1",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "hash-vrep-1",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
          UHID: HSP-VREP-1
          Final Diagnosis: Viral Fever
        `
      }
    ]
  });

  assert.equal(output.validationReport.status, "pass");
  assert.equal(output.validationReport.bundleReports.length, 1);
  assert.equal(output.validationReport.bundleReports[0].status, "pass");
});
