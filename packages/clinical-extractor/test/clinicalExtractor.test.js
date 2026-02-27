import test from "node:test";
import assert from "node:assert/strict";
import { extractStructuredData } from "../src/index.js";
import { getHospitalTemplate } from "../../config/src/index.js";

test("extractStructuredData parses key discharge summary fields", () => {
  const text = `
    DISCHARGE SUMMARY
    Patient Name: Raj Mehta
    UHID: HSP-8891
    Date of Admission: 2026-02-20
    Date of Discharge: 2026-02-23
    Final Diagnosis: Viral Fever
  `;

  const result = extractStructuredData({
    hiType: "discharge_summary",
    text
  });

  assert.equal(result.patientName, "Raj Mehta");
  assert.equal(result.patientLocalId, "HSP-8891");
  assert.equal(result.admissionDate, "2026-02-20");
  assert.equal(result.dischargeDate, "2026-02-23");
  assert.equal(result.finalDiagnosis, "Viral Fever");
});

test("extractStructuredData parses key diagnostic report fields", () => {
  const text = `
    DIAGNOSTIC REPORT
    Patient Name: Raj Mehta
    UHID: HSP-8891
    Test Name: Hemoglobin
    Result: 12.4 g/dL
    Observation Date: 2026-02-22
  `;

  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text
  });

  assert.equal(result.patientName, "Raj Mehta");
  assert.equal(result.patientLocalId, "HSP-8891");
  assert.equal(result.testName, "Hemoglobin");
  assert.equal(result.resultValue, "12.4 g/dL");
  assert.equal(result.observationDate, "2026-02-22");
});

test("extractStructuredData supports template aliases", () => {
  const text = `
    DISCHARGE SUMMARY
    Patient Name: Raj Mehta
    IP No: ALPHA-77
    Date of Admission: 2026-02-20
    Date of Discharge: 2026-02-23
    Diagnosis at Discharge: Viral Fever
  `;

  const template = getHospitalTemplate();
  const result = extractStructuredData({
    hiType: "discharge_summary",
    text,
    template
  });

  assert.equal(result.patientLocalId, "ALPHA-77");
  assert.equal(result.finalDiagnosis, "Viral Fever");
});
