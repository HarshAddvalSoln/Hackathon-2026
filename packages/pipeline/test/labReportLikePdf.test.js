import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline handles OCR-like lab report text as diagnostic_report", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-LAB-1",
    documents: [
      {
        fileName: "1002500515.pdf",
        text: `
          CHANDIGARH MEDICAL LABORATORY
          PatientName : MR. SH Patient|D : B/1181
          Report Date : 30-10-2024
          INVESTIGATION RESULT UNIT BIOLOGICAL REFERENCE RANGE
          B. Urea 273.6 mg/dl 13 - 45
          BUN 127.8 mg/dl 7.0 - 20.0
          S. Creatinine 8.91 mg/dl 0.5 - 1.4
        `
      }
    ]
  });

  assert.equal(output.classifications[0].hiType, "diagnostic_report");
  assert.equal(output.extractionReports[0].status, "pass");
  assert.equal(output.complianceReport.overallStatus, "pass");
  assert.equal(output.validationReport.status, "pass");
});
