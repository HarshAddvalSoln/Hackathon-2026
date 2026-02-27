import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultLlmFallback, createOllamaLlmFallback } from "../src/index.js";

test("createDefaultLlmFallback always returns fallback instance", () => {
  const previous = process.env.LLM_FALLBACK_ENABLED;
  process.env.LLM_FALLBACK_ENABLED = "false";
  const fallback = createDefaultLlmFallback();
  assert.equal(typeof fallback?.enhance, "function");
  process.env.LLM_FALLBACK_ENABLED = previous;
});

test("createOllamaLlmFallback parses and merges structured response", async () => {
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          message: {
            content: JSON.stringify({
              hiType: "diagnostic_report",
              patientName: "Raj Mehta",
              patientLocalId: "UH-10",
              testName: "Hemoglobin",
              resultValue: "12.1 g/dL",
              observationDate: "2026-02-26",
              observations: [{ name: "Hemoglobin", value: "12.1", unit: "g/dL" }]
            })
          }
        };
      }
    })
  });

  const result = await fallback.enhance({
    text: "Lab report text",
    hiType: "unknown",
    extracted: {}
  });

  assert.equal(result.hiType, "diagnostic_report");
  assert.equal(result.extracted.patientName, "Raj Mehta");
  assert.equal(result.extracted.testName, "Hemoglobin");
  assert.equal(result.extracted.observations.length, 1);
});

test("createOllamaLlmFallback does not overwrite existing strong fields", async () => {
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          message: {
            content: JSON.stringify({
              hiType: "diagnostic_report",
              patientName: "Wrong Name",
              patientLocalId: "UH-99"
            })
          }
        };
      }
    })
  });

  const result = await fallback.enhance({
    text: "Lab report text",
    hiType: "diagnostic_report",
    extracted: {
      patientName: "Correct Name",
      patientLocalId: "UH-10"
    }
  });

  assert.equal(result.extracted.patientName, "Correct Name");
  assert.equal(result.extracted.patientLocalId, "UH-10");
});

test("createOllamaLlmFallback returns baseline data on request failure (with retry)", async () => {
  let attempts = 0;
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => {
      attempts += 1;
      return {
        ok: false,
        status: 503,
        async json() {
          return {};
        }
      };
    }
  });

  const result = await fallback.enhance({
    text: "Diagnostic text",
    hiType: "unknown",
    extracted: { patientName: "Test Patient" }
  });

  // Should retry (2 attempts) and then return baseline with original extracted data
  assert.equal(attempts, 2, "Should retry after first failure");
  assert.equal(result.hiType, "unknown");
  assert.equal(result.extracted.patientName, "Test Patient");
  assert.equal(result.diagnostics.status, "failed");
});

test("createOllamaLlmFallback sends enrichment prompt with base extracted data", async () => {
  let capturedPrompt = "";
  const fallback = createOllamaLlmFallback({
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      capturedPrompt = payload.messages[0].content;
      return {
        ok: true,
        async json() {
          return {
            message: {
              content: JSON.stringify({
                hiType: "unknown"
              })
            }
          };
        }
      };
    }
  });

  const longText = `${"A".repeat(5000)}\n${"B".repeat(5000)}`;
  await fallback.enhance({
    text: longText,
    hiType: "unknown",
    extracted: {}
  });

  // New enrichment prompt includes key elements
  assert.ok(capturedPrompt.includes("BASE EXTRACTED DATA"));
  assert.ok(capturedPrompt.includes("EXTRACT FRESH"));
  assert.ok(capturedPrompt.includes("INPUT DOCUMENT TEXT"));
});

test("createOllamaLlmFallback returns baseline data on invalid payload", async () => {
  let attempts = 0;
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => {
      attempts += 1;
      return {
        ok: true,
        async json() {
          return {
            message: {
              content: "not json at all"
            }
          };
        }
      };
    }
  });

  const result = await fallback.enhance({
    text: "diagnostic report text",
    hiType: "unknown",
    extracted: {
      patientLocalId: "UH-11"
    }
  });

  // Invalid payload triggers retry, then returns baseline
  assert.equal(result.hiType, "unknown");
  assert.equal(result.extracted.patientLocalId, "UH-11");
  assert.equal(result.diagnostics.status, "invalid_payload");
  assert.equal(result.diagnostics.attempts, 2); // Retried once
});

test("createOllamaLlmFallback salvages truncated json payload", async () => {
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          message: {
            content:
              "{\"hiType\":\"diagnostic_report\",\"patientName\":null,\"patientLocalId\":null,\"testName\":\"ECHO CARDIOGRAPHY REPORT\",\"resultValue\":\"68%\",\"observationDate\":\"25/02/2025\",\"observations\":[{\"name\":\"AO\",\"value\":\"37mm\",\"unit\":\"mm\"},{\"name\":"
          }
        };
      }
    })
  });

  const result = await fallback.enhance({
    text: "echo report text",
    hiType: "diagnostic_report",
    extracted: {}
  });

  assert.equal(result.hiType, "diagnostic_report");
  assert.equal(result.extracted.testName, "ECHO CARDIOGRAPHY REPORT");
  assert.equal(result.extracted.resultValue, "68%");
  assert.equal(result.extracted.observationDate, "25/02/2025");
  assert.equal(result.extracted.observations.length, 1);
  assert.equal(result.diagnostics.status, "salvaged_partial_json");
});

test("createOllamaLlmFallback supports object content payload", async () => {
  const fallback = createOllamaLlmFallback({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          message: {
            content: {
              hiType: "diagnostic_report",
              patientName: "Raj Mehta",
              patientLocalId: "UH-22",
              testName: "WBC",
              resultValue: "5.0 10^3/uL",
              observations: [
                {
                  name: "WBC",
                  value: "5.0",
                  unit: "10^3/uL"
                }
              ]
            }
          }
        };
      }
    })
  });

  const result = await fallback.enhance({
    text: "diagnostic report",
    hiType: "unknown",
    extracted: {}
  });

  assert.equal(result.hiType, "diagnostic_report");
  assert.equal(result.extracted.patientLocalId, "UH-22");
  assert.equal(result.extracted.observations.length, 1);
});

test("createOllamaLlmFallback uses hardcoded defaults, not env vars", async () => {
  const previousBaseUrl = process.env.LLM_FALLBACK_BASE_URL;
  const previousModel = process.env.LLM_FALLBACK_MODEL;
  process.env.LLM_FALLBACK_BASE_URL = "http://127.0.0.1:9999";
  process.env.LLM_FALLBACK_MODEL = "bad-model";

  let capturedUrl = "";
  let capturedModel = "";
  const fallback = createOllamaLlmFallback({
    fetchImpl: async (url, options) => {
      capturedUrl = String(url);
      const payload = JSON.parse(options.body);
      capturedModel = payload.model;
      return {
        ok: true,
        async json() {
          return {
            message: {
              content: JSON.stringify({
                hiType: "unknown"
              })
            }
          };
        }
      };
    }
  });

  await fallback.enhance({
    text: "diagnostic report",
    hiType: "unknown",
    extracted: {}
  });

  assert.equal(capturedUrl, "http://127.0.0.1:11434/api/chat");
  assert.equal(capturedModel, "gemma3:4b");

  process.env.LLM_FALLBACK_BASE_URL = previousBaseUrl;
  process.env.LLM_FALLBACK_MODEL = previousModel;
});
