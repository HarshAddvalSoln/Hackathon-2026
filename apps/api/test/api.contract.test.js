import test from "node:test";
import assert from "node:assert/strict";
import { createApiService } from "../src/server.js";

test("POST /v1/claims/convert creates a job and GET returns completed output", async () => {
  const api = createApiService();

  const postResponse = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      claimId: "CLM-3001",
      documents: [
        {
          fileName: "discharge-summary.pdf",
          text: `
            DISCHARGE SUMMARY
            Patient Name: Raj Mehta
            UHID: HSP-8891
            Date of Admission: 2026-02-20
            Date of Discharge: 2026-02-23
            Final Diagnosis: Viral Fever
          `
        }
      ]
    }
  });

  assert.equal(postResponse.statusCode, 200);
  const postBody = postResponse.body;
  assert.equal(postBody.status, "completed");
  assert.ok(postBody.jobId);
  assert.equal(postBody.output.bundles.length, 1);
  assert.equal(postBody.output.classifications[0].hiType, "discharge_summary");

  const getResponse = await api.handle({
    method: "GET",
    url: `/v1/claims/convert/${postBody.jobId}`,
    body: {}
  });
  assert.equal(getResponse.statusCode, 200);
  const getBody = getResponse.body;

  assert.equal(getBody.status, "completed");
  assert.equal(getBody.output.bundles.length, 1);
  assert.equal(getBody.output.classifications[0].hiType, "discharge_summary");
  assert.equal(getBody.output.complianceReport.overallStatus, "pass");
  assert.equal(getBody.output.extractionReports.length, 1);
  assert.equal(getBody.output.extractionReports[0].status, "pass");
  assert.equal(getBody.output.validationReport.status, "pass");
});

test("GET /v1/claims/convert/:jobId returns 404 for unknown job", async () => {
  const api = createApiService();
  const response = await api.handle({
    method: "GET",
    url: "/v1/claims/convert/JOB-UNKNOWN",
    body: {}
  });

  assert.equal(response.statusCode, 404);
  const body = response.body;
  assert.equal(body.error, "job_not_found");
});

test("POST /v1/claims/convert accepts req.files-style payload", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return {
          text: "DIAGNOSTIC REPORT\nPatient Name: X\nUHID: U-1\nTest Name: Hb\nResult: 12",
          mode: "ocr_worker"
        };
      }
    }
  });

  const postResponse = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: { claimId: "CLM-FILES-1" },
    files: [
      {
        fileName: "uploaded.pdf",
        filePath: "/tmp/uploaded.pdf"
      }
    ]
  });

  assert.equal(postResponse.statusCode, 200);
  assert.equal(postResponse.body.status, "completed");
});

test("POST /v1/claims/convert auto-generates claimId when missing", async () => {
  const api = createApiService();

  const postResponse = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      documents: [
        {
          fileName: "discharge-summary.pdf",
          text: "DISCHARGE SUMMARY\nPatient Name: Raj\nUHID: H1\nFinal Diagnosis: Fever"
        }
      ]
    }
  });

  assert.equal(postResponse.statusCode, 200);
  assert.match(postResponse.body.output.claimId, /^CLM-/);
});

test("POST /v1/claims/convert/ accepts trailing slash", async () => {
  const api = createApiService();

  const postResponse = await api.handle({
    method: "POST",
    url: "/v1/claims/convert/",
    body: {
      documents: [
        {
          fileName: "diagnostic-report.pdf",
          text: "DIAGNOSTIC REPORT\nPatient Name: Raj\nUHID: H1\nTest Name: Hb\nResult: 12 g/dL"
        }
      ]
    }
  });

  assert.equal(postResponse.statusCode, 200);
  assert.equal(postResponse.body.status, "completed");
});

test("POST /v1/claims/convert merges JSON documents string and uploaded files", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return {
          text: "DIAGNOSTIC REPORT\nPatient Name: X\nUHID: U-1\nTest Name: Hb\nResult: 12",
          mode: "ocr_worker"
        };
      }
    }
  });

  const postResponse = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      documents: JSON.stringify([
        {
          fileName: "inline.pdf",
          text: "DISCHARGE SUMMARY\nPatient Name: A\nUHID: P1\nFinal Diagnosis: Fever"
        }
      ])
    },
    files: [
      {
        fileName: "uploaded.pdf",
        filePath: "/tmp/uploaded.pdf"
      }
    ]
  });

  assert.equal(postResponse.statusCode, 200);
  assert.equal(postResponse.body.output.bundles.length, 2);
});

test("POST /v1/claims/convert returns extraction failure details when OCR backend is unavailable", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return {
          text: "",
          mode: "extraction_failed",
          metadata: {
            reason: "scan_requires_ocr_backend_unreachable",
            fatal: true
          }
        };
      }
    }
  });

  const response = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      claimId: "CLM-FAIL-1",
      documents: [
        {
          fileName: "scan.pdf",
          filePath: "/tmp/scan.pdf"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.body.error, "document_extraction_failed");
  assert.equal(response.body.details.fileName, "scan.pdf");
  assert.equal(response.body.details.reason, "scan_requires_ocr_backend_unreachable");
});
