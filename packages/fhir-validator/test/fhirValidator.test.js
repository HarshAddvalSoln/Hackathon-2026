import test from "node:test";
import assert from "node:assert/strict";
import { validateClaimBundle } from "../src/index.js";
import { mapToClaimSubmissionBundle } from "../../fhir-mapper/src/index.js";

test("validateClaimBundle passes for a minimally valid claim bundle", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-VAL-1",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-VAL-1",
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-val-1"
    }
  });

  const report = validateClaimBundle(bundle);
  assert.equal(report.status, "pass");
  assert.equal(report.errors.length, 0);
});

test("validateClaimBundle fails when patient identifier is missing", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-VAL-2",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: null,
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-val-2"
    }
  });
  const patient = bundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "Patient");
  patient.identifier[0].value = "UNKNOWN";

  const report = validateClaimBundle(bundle);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "PATIENT_IDENTIFIER_MISSING"));
});

test("validateClaimBundle fails when bundle profile is missing", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-VAL-3",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-VAL-3",
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-val-3"
    }
  });
  delete bundle.meta.profile;

  const report = validateClaimBundle(bundle);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "BUNDLE_PROFILE_MISSING"));
});

test("validateClaimBundle fails when DiagnosticReport has no observations", () => {
  const bundle = {
    resourceType: "Bundle",
    meta: { profile: ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"] },
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "patient-1",
          identifier: [{ value: "P-1" }],
          name: [{ text: "Test Patient" }]
        }
      },
      {
        resource: {
          resourceType: "DiagnosticReport",
          id: "diagnostic-report-1",
          subject: { reference: "Patient/patient-1" },
          result: []
        }
      },
      {
        resource: {
          resourceType: "DocumentReference",
          id: "source-doc-1",
          subject: { reference: "Patient/patient-1" },
          identifier: [{ value: "hash-x" }]
        }
      }
    ]
  };

  const report = validateClaimBundle(bundle);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "DIAGNOSTIC_OBSERVATION_MISSING"));
  assert.ok(report.errors.some((e) => e.code === "DIAGNOSTIC_REPORT_RESULT_MISSING"));
});

test("validateClaimBundle fails when DiagnosticReport references unknown observation", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-VAL-4",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-VAL-4",
      testName: "BUN",
      resultValue: "127.8 mg/dl"
    },
    sourceDocument: {
      fileName: "diagnostic-report.pdf",
      sha256: "hash-val-4"
    }
  });

  const diagnosticReport = bundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "DiagnosticReport");
  diagnosticReport.result = [{ reference: "Observation/not-present" }];

  const report = validateClaimBundle(bundle);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "DIAGNOSTIC_REPORT_RESULT_REFERENCE_INVALID"));
});
