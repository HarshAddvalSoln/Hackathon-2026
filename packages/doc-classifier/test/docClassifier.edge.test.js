import test from "node:test";
import assert from "node:assert/strict";
import { detectHiType } from "../src/index.js";

test("detectHiType is case-insensitive", () => {
  assert.equal(detectHiType("dIsChaRge SumMary"), "discharge_summary");
  assert.equal(detectHiType("DIAGNOSTIC REPORT"), "diagnostic_report");
});

test("detectHiType prefers discharge when both hint sets are present", () => {
  const text = "Discharge Summary with Test Name and Observation Date.";
  assert.equal(detectHiType(text), "discharge_summary");
});

test("detectHiType handles nullish input", () => {
  assert.equal(detectHiType(undefined), "unknown");
  assert.equal(detectHiType(null), "unknown");
  assert.equal(detectHiType(""), "unknown");
});

test("detectHiType classifies lab-style OCR text as diagnostic report", () => {
  const text = `
    CHANDIGARH MEDICAL LABORATORY
    INVESTIGATION RESULT UNIT BIOLOGICAL REFERENCE RANGE
    RENAL FUNCTION TEST
    B. Urea 273.6 mg/dl
    Report Date : 30-10-2024
  `;
  assert.equal(detectHiType(text), "diagnostic_report");
});

test("detectHiType classifies investigation/lab terminology as diagnostic report", () => {
  const text = `
    LABORATORY REPORT
    INVESTIGATION REPORT
    HAEMATOLOGY
    CBC
    REFERENCE INTERVAL
  `;
  assert.equal(detectHiType(text), "diagnostic_report");
});

test("detectHiType classifies discharge clinical summary vocabulary", () => {
  const text = `
    CLINICAL SUMMARY
    Date of Admission : 01-02-2026
    Date of Discharge : 04-02-2026
    Condition at Discharge : Stable
    Follow-up after 7 days
  `;
  assert.equal(detectHiType(text), "discharge_summary");
});

test("detectHiType classifies echocardiography narrative as diagnostic report", () => {
  const text = `
    ECHO CARDIOGRAPHY REPORT
    COLOUR DOPPLER FINDINGS
    LVEF 65-70%
    Grade I diastolic dysfunction
  `;
  assert.equal(detectHiType(text), "diagnostic_report");
});
