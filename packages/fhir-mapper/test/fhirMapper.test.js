import test from "node:test";
import assert from "node:assert/strict";
import { mapToClaimSubmissionBundle } from "../src/index.js";

test("mapToClaimSubmissionBundle maps discharge summary to Bundle", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-1001",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-8891",
      admissionDate: "2026-02-20",
      dischargeDate: "2026-02-23",
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "abc123"
    }
  });

  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  assert.equal(bundle.meta.profile[0], "https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle");

  const patient = bundle.entry.find((e) => e.resource.resourceType === "Patient")?.resource;
  assert.ok(patient);
  assert.equal(patient.identifier[0].value, "HSP-8891");

  const condition = bundle.entry.find((e) => e.resource.resourceType === "Condition")?.resource;
  assert.ok(condition);
  assert.equal(condition.code.text, "Viral Fever");

  const encounter = bundle.entry.find((e) => e.resource.resourceType === "Encounter")?.resource;
  assert.ok(encounter);
  assert.equal(encounter.period.start, "2026-02-20");
  assert.equal(encounter.period.end, "2026-02-23");

  const composition = bundle.entry.find((e) => e.resource.resourceType === "Composition")?.resource;
  assert.ok(composition);
  assert.equal(composition.title, "Discharge Summary");

  const docRef = bundle.entry.find((e) => e.resource.resourceType === "DocumentReference")?.resource;
  assert.ok(docRef);
  assert.equal(docRef.identifier[0].value, "abc123");
});

test("mapToClaimSubmissionBundle maps multiple observations for diagnostic report", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-1002",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-9000",
      observationDate: "30-10-2024",
      observations: [
        { name: "B. Urea", value: "273.6", unit: "mg/dl" },
        { name: "BUN", value: "127.8", unit: "mg/dl" }
      ]
    },
    sourceDocument: {
      fileName: "diagnostic-report.pdf",
      sha256: "def456"
    }
  });

  const observations = bundle.entry
    .map((e) => e.resource)
    .filter((r) => r.resourceType === "Observation");
  const diagnosticReport = bundle.entry
    .map((e) => e.resource)
    .find((r) => r.resourceType === "DiagnosticReport");

  assert.equal(observations.length, 2);
  assert.ok(diagnosticReport);
  assert.equal(diagnosticReport.result.length, 2);
  assert.equal(diagnosticReport.result[0].reference, "Observation/observation-1");
  assert.equal(observations[0].code.text, "B. Urea");
  assert.equal(observations[1].code.text, "BUN");
  assert.equal(observations[0].valueQuantity.value, 273.6);
  assert.equal(observations[1].valueQuantity.unit, "mg/dl");
});

test("mapToClaimSubmissionBundle normalizes dd-mm-yyyy dates to ISO", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-1003",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "Demo",
      patientLocalId: "P-1",
      testName: "BUN",
      resultValue: "127.8 mg/dl",
      observationDate: "30-10-2024"
    },
    sourceDocument: {
      fileName: "diagnostic-report.pdf",
      sha256: "date123"
    }
  });

  const diagnosticReport = bundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "DiagnosticReport");
  assert.equal(diagnosticReport.effectiveDateTime, "2024-10-30");
});

test("mapToClaimSubmissionBundle normalizes dd/mm/yyyy dates to ISO", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-1004",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "Demo",
      patientLocalId: "P-2",
      testName: "Echo",
      resultValue: "Normal",
      observationDate: "25/02/2025"
    },
    sourceDocument: {
      fileName: "diagnostic-report.pdf",
      sha256: "slash123"
    }
  });

  const diagnosticReport = bundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "DiagnosticReport");
  assert.equal(diagnosticReport.effectiveDateTime, "2025-02-25");
});

test("mapToClaimSubmissionBundle auto-fills patient identity when OCR misses demographics", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-1005",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "MR.",
      patientLocalId: "Age",
      testName: "Echo",
      resultValue: "Normal"
    },
    sourceDocument: {
      fileName: "echo-report.pdf",
      sha256: "5e6c234cd26e9385e3c256364669764c178e3f275829ea76b8d70f1283a19153"
    }
  });

  const patient = bundle.entry.find((entry) => entry.resource.resourceType === "Patient")?.resource;
  assert.ok(patient);
  assert.equal(patient.identifier[0].value, "AUTO-5E6C234CD26E");
  assert.equal(patient.name[0].text, "Unknown Patient");
  assert.equal(patient.extension[0].valueBoolean, true);
});
