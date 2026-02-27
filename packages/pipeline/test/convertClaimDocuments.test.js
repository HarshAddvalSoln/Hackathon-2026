import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("convertClaimDocuments processes multiple PDFs into one claim bundle", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-1001",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "hash-discharge",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
          UHID: HSP-8891
          Date of Admission: 2026-02-20
          Date of Discharge: 2026-02-23
          Final Diagnosis: Viral Fever
        `
      },
      {
        fileName: "diagnostic-report.pdf",
        sha256: "hash-lab",
        text: `
          DIAGNOSTIC REPORT
          Patient Name: Raj Mehta
          UHID: HSP-8891
          Test Name: Hemoglobin
          Result: 12.4 g/dL
          Observation Date: 2026-02-22
        `
      }
    ]
  });

  assert.equal(output.classifications.length, 2);
  assert.deepEqual(
    output.classifications.map((item) => item.hiType),
    ["discharge_summary", "diagnostic_report"]
  );

  assert.equal(output.bundles.length, 2);
  assert.equal(output.bundles[0].resourceType, "Bundle");
  assert.equal(output.bundles[1].resourceType, "Bundle");
});
