import test from "node:test";
import assert from "node:assert/strict";
import { detectHiType } from "../src/index.js";

test("detectHiType classifies discharge summary", () => {
  const text = `
    DISCHARGE SUMMARY
    Date of Admission: 2026-02-20
    Date of Discharge: 2026-02-23
    Final Diagnosis: Viral Fever
  `;
  assert.equal(detectHiType(text), "discharge_summary");
});

test("detectHiType classifies diagnostic report", () => {
  const text = `
    DIAGNOSTIC REPORT
    Test Name: Hemoglobin
    Result: 12.4 g/dL
    Reference Range: 12-16 g/dL
  `;
  assert.equal(detectHiType(text), "diagnostic_report");
});

test("detectHiType returns unknown when hints are absent", () => {
  const text = "Patient came for follow-up and was advised hydration.";
  assert.equal(detectHiType(text), "unknown");
});
