import test from "node:test";
import assert from "node:assert/strict";
import { validateClaimBundle, validateClaimBundles } from "../src/index.js";

test("validateClaimBundle fails when resourceType is not Bundle", () => {
  const report = validateClaimBundle({ resourceType: "Patient", entry: [] });
  assert.equal(report.status, "fail");
  const error = report.errors.find((e) => e.code === "BUNDLE_RESOURCE_TYPE_INVALID");
  assert.ok(error);
  assert.equal(error.path, "resourceType");
});

test("validateClaimBundle fails when patient/docRef resources are missing", () => {
  const report = validateClaimBundle({
    resourceType: "Bundle",
    meta: { profile: ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"] },
    entry: []
  });

  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "PATIENT_MISSING"));
  assert.ok(report.errors.some((e) => e.code === "DOCUMENT_REFERENCE_MISSING"));
});

test("validateClaimBundle fails when DocumentReference subject does not match Patient", () => {
  const report = validateClaimBundle({
    resourceType: "Bundle",
    meta: { profile: ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"] },
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "patient-1",
          identifier: [{ value: "P-1" }],
          name: [{ text: "Demo Patient" }]
        }
      },
      {
        resource: {
          resourceType: "Condition",
          id: "condition-1",
          subject: { reference: "Patient/patient-1" },
          code: { text: "Fever" }
        }
      },
      {
        resource: {
          resourceType: "DocumentReference",
          id: "source-doc-1",
          subject: { reference: "Patient/another-patient" },
          identifier: [{ value: "sha" }]
        }
      }
    ]
  });

  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "DOCUMENT_REFERENCE_SUBJECT_INVALID"));
});

test("validateClaimBundle fails when bundle has duplicate resource ids", () => {
  const report = validateClaimBundle({
    resourceType: "Bundle",
    meta: { profile: ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"] },
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "dup-1",
          identifier: [{ value: "P-1" }],
          name: [{ text: "Demo Patient" }]
        }
      },
      {
        resource: {
          resourceType: "Condition",
          id: "dup-1",
          subject: { reference: "Patient/dup-1" },
          code: { text: "Fever" }
        }
      },
      {
        resource: {
          resourceType: "DocumentReference",
          id: "source-doc-1",
          subject: { reference: "Patient/dup-1" },
          identifier: [{ value: "sha" }]
        }
      }
    ]
  });

  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "DUPLICATE_RESOURCE_ID"));
});

test("validateClaimBundle fails when patient name is missing", () => {
  const report = validateClaimBundle({
    resourceType: "Bundle",
    meta: { profile: ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"] },
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "patient-1",
          identifier: [{ value: "P-1" }],
          name: []
        }
      },
      {
        resource: {
          resourceType: "Condition",
          id: "condition-1",
          subject: { reference: "Patient/patient-1" },
          code: { text: "Fever" }
        }
      },
      {
        resource: {
          resourceType: "DocumentReference",
          id: "source-doc-1",
          subject: { reference: "Patient/patient-1" },
          identifier: [{ value: "sha" }]
        }
      }
    ]
  });

  assert.equal(report.status, "fail");
  assert.ok(report.errors.some((e) => e.code === "PATIENT_NAME_MISSING"));
});

test("validateClaimBundles handles empty input", () => {
  const report = validateClaimBundles([]);
  assert.equal(report.status, "pass");
  assert.deepEqual(report.bundleReports, []);
});
