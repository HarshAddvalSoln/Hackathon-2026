import test from "node:test";
import assert from "node:assert/strict";
import { createApiService } from "../src/server.js";
import { validateConvertRequest } from "../src/validation.js";

test("GET /health returns ok", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return { text: "stub", mode: "digital" };
      },
      async health() {
        return {
          ok: true,
          ocr: {
            ok: true
          }
        };
      }
    }
  });
  const response = await api.handle({ method: "GET", url: "/health", body: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.ocr, "object");
});

test("GET /health returns not ok when OCR health is failing", async () => {
  const api = createApiService({
    extractionEngine: {
      async extract() {
        return { text: "", mode: "extraction_empty", metadata: { reason: "stub" } };
      },
      async health() {
        return {
          ok: false,
          ocr: {
            ok: false,
            error: "backend_unreachable"
          }
        };
      }
    }
  });
  const response = await api.handle({ method: "GET", url: "/health", body: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.ocr.ok, false);
});

test("unknown route returns not_found", async () => {
  const api = createApiService();
  const response = await api.handle({ method: "GET", url: "/unknown", body: {} });
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, "not_found");
});

test("validateConvertRequest catches non-array documents", () => {
  const result = validateConvertRequest({
    claimId: "CLM-1",
    documents: "bad"
  });
  assert.equal(result.ok, false);
  assert.ok(result.details.some((d) => d.path === "documents"));
});
