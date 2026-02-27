import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCompliance } from "../src/index.js";
import { mapToClaimSubmissionBundle } from "../../fhir-mapper/src/index.js";

test("evaluateCompliance passes when identifier and audit requirements are met", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-2001",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-9001",
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-001"
    }
  });

  const report = evaluateCompliance({
    bundles: [bundle],
    auditLog: [
      { action: "convert_started", actor: "system" },
      { action: "bundle_generated", actor: "system" },
      { action: "result_viewed", actor: "api-user" }
    ]
  });

  assert.equal(report.overallStatus, "pass");
});

test("evaluateCompliance fails when patient identifier is missing", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-2002",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: null,
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-002"
    }
  });
  const patient = bundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "Patient");
  patient.identifier[0].value = "UNKNOWN";

  const report = evaluateCompliance({
    bundles: [bundle],
    auditLog: [
      { action: "convert_started", actor: "system" },
      { action: "bundle_generated", actor: "system" },
      { action: "result_viewed", actor: "api-user" }
    ]
  });

  assert.equal(report.overallStatus, "fail");
  assert.equal(report.checks.find((c) => c.ruleId === "NRCES-ID-01")?.status, "fail");
});

test("evaluateCompliance fails when audit trail actions are missing", () => {
  const bundle = mapToClaimSubmissionBundle({
    claimId: "CLM-2003",
    hiType: "discharge_summary",
    extracted: {
      patientName: "Raj Mehta",
      patientLocalId: "HSP-9002",
      finalDiagnosis: "Viral Fever"
    },
    sourceDocument: {
      fileName: "discharge-summary.pdf",
      sha256: "hash-003"
    }
  });

  const report = evaluateCompliance({
    bundles: [bundle],
    auditLog: [{ action: "convert_started", actor: "system" }]
  });

  assert.equal(report.overallStatus, "fail");
  assert.equal(report.checks.find((c) => c.ruleId === "NRCES-AUDIT-01")?.status, "fail");
});
