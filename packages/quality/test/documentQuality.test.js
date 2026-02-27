import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDocumentQuality } from "../src/index.js";
import { getHospitalTemplate } from "../../config/src/index.js";

test("document quality passes when required fields are present", () => {
  const template = getHospitalTemplate("default");
  const report = evaluateDocumentQuality({
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-9",
      finalDiagnosis: "Viral Fever"
    },
    template
  });

  assert.equal(report.status, "pass");
  assert.equal(report.missingRequiredFields.length, 0);
});

test("document quality marks warning when required fields are missing", () => {
  const template = getHospitalTemplate("default");
  const report = evaluateDocumentQuality({
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: null,
      finalDiagnosis: null
    },
    template
  });

  assert.equal(report.status, "warning");
  assert.ok(report.missingRequiredFields.includes("patientLocalId"));
  assert.ok(report.missingRequiredFields.includes("finalDiagnosis"));
});
