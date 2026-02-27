import test from "node:test";
import assert from "node:assert/strict";
import { extractStructuredData } from "../src/index.js";

test("extractStructuredData returns empty object for unknown HI type", () => {
  const result = extractStructuredData({
    hiType: "unknown",
    text: "random text"
  });
  assert.deepEqual(result, {});
});

test("extractStructuredData trims extracted values", () => {
  const result = extractStructuredData({
    hiType: "discharge_summary",
    text: `
      DISCHARGE SUMMARY
      Patient Name:   Raj Mehta   
      UHID:   HSP-EDGE-1   
      Final Diagnosis:   Viral Fever   
    `
  });

  assert.equal(result.patientName, "Raj Mehta");
  assert.equal(result.patientLocalId, "HSP-EDGE-1");
  assert.equal(result.finalDiagnosis, "Viral Fever");
});

test("extractStructuredData supports custom label with regex special chars", () => {
  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text: `
      DIAGNOSTIC REPORT
      Patient Name: Raj Mehta
      ID(No): ZX-99
      Result+Value: 5.4
    `,
    template: {
      extractors: {
        diagnostic_report: {
          patientName: ["Patient Name"],
          patientLocalId: ["ID(No)"],
          testName: ["Test Name"],
          resultValue: ["Result+Value"],
          observationDate: ["Observation Date"]
        }
      }
    }
  });

  assert.equal(result.patientLocalId, "ZX-99");
  assert.equal(result.resultValue, "5.4");
});

test("extractStructuredData parses diagnostic table rows from OCR-like text", () => {
  const text = `
    PatientName : MR. SH Patient|D : B/1181
    Report Date : 30-10-2024
    INVESTIGATION RESULT UNIT BIOLOGICAL REFERENCE RANGE
    B. Urea 273.6 mg/dl 13 - 45
    BUN 127.8 mg/dl 7.0 - 20.0
    S. Creatinine 8.91 mg/dl 0.5 - 1.4
  `;

  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text
  });

  assert.equal(result.patientLocalId, "B/1181");
  assert.equal(result.observationDate, "30-10-2024");
  assert.ok(Array.isArray(result.observations));
  assert.ok(result.observations.length >= 3);
  assert.equal(result.observations[0].name, "B. Urea");
});

test("extractStructuredData rejects title-only name and prefers valid patient id", () => {
  const text = `
    DIAGNOSTIC REPORT
    Patient Name : MR. Age : 58 Gender : Male
    Patient ID : Age
    Patient|D : B/1181
    Report Date : 30-10-2024
    B. Urea 273.6 mg/dl 13 - 45
  `;

  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text
  });

  assert.equal(result.patientName, null);
  assert.equal(result.patientLocalId, "B/1181");
});

test("extractStructuredData supports OCR labels without colon separators", () => {
  const text = `
    DIAGNOSTIC REPORT
    Name Mr Raj Mehta Patient ID HSP-7788
    Report Date 25/02/2025
    ECHO CARDIOGRAPHY REPORT
  `;

  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text
  });

  assert.equal(result.patientName, "Mr Raj Mehta");
  assert.equal(result.patientLocalId, "HSP-7788");
  assert.equal(result.observationDate, "25/02/2025");
});

test("extractStructuredData ignores non-clinical rows while parsing diagnostic observations", () => {
  const text = `
    DIAGNOSTIC REPORT
    PMC Regn. No. 47564 Ph: 8872917197
    WBC 5.03 10^3/uL 4.00 - 10.00
    HGB 11.4 g/dL 11.0 - 16.0
  `;

  const result = extractStructuredData({
    hiType: "diagnostic_report",
    text
  });

  assert.equal(result.testName, "WBC");
  assert.equal(result.resultValue, "5.03 10^3/uL");
  assert.equal(result.observations.length, 2);
  assert.ok(result.observations.every((item) => !/regn|ph/i.test(item.name)));
});
