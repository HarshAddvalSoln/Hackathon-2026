import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline applies llm enrichment to recover unknown hiType", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-LLM-1",
    hospitalId: "default",
    documents: [
      {
        fileName: "ambiguous.txt",
        text: "Specimen: blood. Hb 12.4 g/dL. Ref range 12-16."
      }
    ],
    llmFallback: {
      async enhance() {
        return {
          hiType: "diagnostic_report",
          extracted: {
            patientName: "Raj Mehta",
            patientLocalId: "UH-123",
            testName: "Hemoglobin",
            resultValue: "12.4 g/dL",
            observationDate: "2026-02-26",
            observations: [{ name: "Hemoglobin", value: "12.4", unit: "g/dL" }]
          },
          diagnostics: {
            provider: "ollama"
          }
        };
      }
    }
  });

  assert.equal(output.classifications[0].hiType, "diagnostic_report");
  assert.equal(output.qualityReports[0].status, "pass");
  assert.equal(output.extractionReports[0].extracted.testName, "Hemoglobin");
  assert.equal(output.extractionReports[0].extractionDiagnostics.llmEnrichment.status, "applied");
  assert.ok(output.auditLog.some((item) => item.action === "llm_enrichment_applied"));
});

test("pipeline applies llm enrichment even when fields do not improve", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-LLM-2",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge.txt",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
        `
      }
    ],
    llmFallback: {
      async enhance() {
        return {
          hiType: "unknown",
          extracted: {},
          diagnostics: {
            provider: "ollama"
          }
        };
      }
    }
  });

  assert.equal(output.classifications[0].hiType, "discharge_summary");
  assert.equal(output.extractionReports[0].status, "warning");
  assert.equal(output.extractionReports[0].extractionDiagnostics.llmEnrichment.status, "applied");
});

test("pipeline applies llm enrichment when extracted richness improves despite same quality score", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-LLM-3",
    hospitalId: "default",
    documents: [
      {
        fileName: "discharge-richness.txt",
        text: `
          DISCHARGE SUMMARY
          Patient Name: Raj Mehta
        `
      }
    ],
    llmFallback: {
      async enhance() {
        return {
          hiType: "discharge_summary",
          extracted: {
            patientName: "Raj Mehta",
            admissionDate: "2025-02-25"
          },
          diagnostics: {
            provider: "ollama",
            status: "parsed"
          }
        };
      }
    }
  });

  assert.equal(output.classifications[0].hiType, "discharge_summary");
  assert.equal(output.extractionReports[0].status, "warning");
  assert.equal(output.extractionReports[0].extracted.admissionDate, "2025-02-25");
  assert.equal(output.extractionReports[0].extractionDiagnostics.llmEnrichment.status, "applied");
});

test("pipeline skips llm enrichment when initial quality is pass", async () => {
  let calls = 0;
  const output = await convertClaimDocuments({
    claimId: "CLM-LLM-4",
    hospitalId: "default",
    documents: [
      {
        fileName: "diagnostic-pass.txt",
        text: `
          Diagnostic Report
          Patient Name: Raj Mehta
          Patient ID: UH-90
          Test Name: Hemoglobin
          Result: 12.4 g/dL
        `
      }
    ],
    llmFallback: {
      async enhance() {
        calls += 1;
        return {
          hiType: "diagnostic_report",
          extracted: {}
        };
      }
    }
  });

  // LLM enrichment should be skipped when quality already passes
  assert.equal(calls, 0, "LLM enrichment should not be called when quality is already pass");
  assert.equal(output.extractionReports[0].confidenceScore, 1);
});
