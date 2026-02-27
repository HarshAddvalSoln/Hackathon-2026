import test from "node:test";
import assert from "node:assert/strict";
import { createApiService } from "../src/server.js";

test("POST /v1/claims/convert returns field errors for invalid payload", async () => {
  const api = createApiService();

  const response = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      claimId: "",
      documents: [{}]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_request");
  assert.ok(Array.isArray(response.body.details));
  assert.ok(response.body.details.some((d) => d.path === "documents[0].fileName"));
  assert.ok(response.body.details.some((d) => d.path === "documents[0].text"));
});

test("POST /v1/claims/convert accepts valid payload with hospital template", async () => {
  const api = createApiService();

  const response = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      claimId: "CLM-VALID-1",
      hospitalId: "hsp-alpha",
      documents: [
        {
          fileName: "discharge-summary.pdf",
          sha256: "hash-abc",
          text: "DISCHARGE SUMMARY\nPatient Name: Raj Mehta\nUHID: HSP-1\nFinal Diagnosis: Viral Fever"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "completed");
});

test("POST /v1/claims/convert accepts PDF-only payload via filePath", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return {
          text: "DISCHARGE SUMMARY\nPatient Name: Raj\nUHID: HSP-1\nFinal Diagnosis: Fever",
          mode: "digital_pdfjs"
        };
      }
    }
  });

  const response = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      claimId: "CLM-VALID-2",
      documents: [
        {
          fileName: "discharge-summary.pdf",
          sha256: "hash-pdf-1",
          filePath: "/tmp/discharge-summary.pdf"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "completed");
});

test("POST /v1/claims/convert rejects malformed documents JSON string", async () => {
  const api = createApiService();

  const response = await api.handle({
    method: "POST",
    url: "/v1/claims/convert",
    body: {
      documents: "{ bad-json"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_request");
  assert.ok(response.body.details.some((d) => d.path === "documents"));
});
