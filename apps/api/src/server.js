import http from "node:http";
import { randomUUID } from "node:crypto";
import { convertClaimDocuments } from "../../../packages/pipeline/src/index.js";
import { validateConvertRequest } from "./validation.js";
import { createExtractionEngine } from "../../../packages/extraction-engine/src/index.js";
import { createPdfjsAdapter } from "../../../packages/extraction-engine/src/adapters/pdfjsAdapter.js";
import { createDefaultOcrEngine } from "../../ocr-worker/src/service.js";
import { createDefaultLlmFallback } from "../../../packages/llm-fallback/src/index.js";
import { parseMultipartFormData } from "./multipart.js";

function logError(event, error, meta = {}) {
  // eslint-disable-next-line no-console
  console.error(`[api:error] ${event}`, {
    ...meta,
    message: error?.message,
    stack: error?.stack
  });
}

function logInfo(event, meta = {}) {
  // eslint-disable-next-line no-console
  console.log(`[api:info] ${event}`, meta);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function normalizePath(url) {
  if (typeof url !== "string") {
    return "";
  }
  if (url.length > 1 && url.endsWith("/")) {
    return url.slice(0, -1);
  }
  return url;
}

function normalizeDocumentsInput(body, files) {
  const mergedBody = { ...(body || {}) };

  if (typeof mergedBody.documents === "string") {
    try {
      mergedBody.documents = JSON.parse(mergedBody.documents);
    } catch {
      // Request validation will handle invalid shape.
    }
  }

  const fileDocuments = (files || []).map((file) => ({
    fileName: file.fileName,
    filePath: file.filePath
  }));
  if (!Array.isArray(mergedBody.documents)) {
    mergedBody.documents = [];
  }
  if (fileDocuments.length > 0) {
    mergedBody.documents = [...mergedBody.documents, ...fileDocuments];
  }

  return mergedBody;
}

function createDefaultExtractionEngine() {
  const ocrEngine = createDefaultOcrEngine();
  const inProcessOcrAdapter = {
    async extract(document) {
      const extracted = await ocrEngine.extract(document);
      return {
        text: extracted?.text || "",
        mode: "ocr_inprocess",
        metadata: {
          confidence: extracted?.confidence ?? 0,
          diagnostics: extracted?.diagnostics || null
        }
      };
    }
  };

  const engine = createExtractionEngine({
    digitalAdapter: createPdfjsAdapter(),
    ocrAdapter: inProcessOcrAdapter,
    ocrForAllPdfs: true
  });

  return {
    ...engine,
    async health() {
      if (typeof ocrEngine?.checkHealth !== "function") {
        return { ok: true, ocr: { ok: "unknown" } };
      }
      const ocrHealth = await ocrEngine.checkHealth();
      return {
        ok: Boolean(ocrHealth?.ok),
        ocr: ocrHealth
      };
    }
  };
}

export function createApiService({ extractionEngine } = {}) {
  const jobs = new Map();
  const engine = extractionEngine || createDefaultExtractionEngine();
  const llmFallback = createDefaultLlmFallback();

  return {
    async handle({ method, url, body, files }) {
      const normalizedUrl = normalizePath(url);
      logInfo("request_received", {
        method,
        url: normalizedUrl || url,
        hasBody: Boolean(body && Object.keys(body).length > 0),
        filesCount: Array.isArray(files) ? files.length : 0
      });

      if (method === "POST" && normalizedUrl === "/v1/claims/convert") {
        const mergedBody = normalizeDocumentsInput(body, files);
        logInfo("convert_request_normalized", {
          documentsCount: Array.isArray(mergedBody?.documents) ? mergedBody.documents.length : 0,
          hasHospitalId: typeof mergedBody?.hospitalId === "string" && mergedBody.hospitalId.trim().length > 0,
          hasClaimId: typeof mergedBody?.claimId === "string" && mergedBody.claimId.trim().length > 0
        });

        const validation = validateConvertRequest(mergedBody);
        if (!validation.ok) {
          logInfo("convert_request_invalid", {
            detailsCount: Array.isArray(validation.details) ? validation.details.length : 0
          });
          return {
            statusCode: 400,
            body: { error: "invalid_request", details: validation.details }
          };
        }

        const claimId = (typeof mergedBody.claimId === "string" && mergedBody.claimId.trim())
          ? mergedBody.claimId.trim()
          : `CLM-${randomUUID()}`;
        const documents = mergedBody.documents;
        const hospitalId = mergedBody.hospitalId;

        const jobId = randomUUID();
        jobs.set(jobId, {
          status: "queued",
          createdAt: new Date().toISOString(),
          output: null
        });
        logInfo("job_queued", {
          jobId,
          claimId,
          documentsCount: Array.isArray(documents) ? documents.length : 0
        });

        let output;
        const conversionStartMs = Date.now();
        try {
          logInfo("conversion_started", {
            jobId,
            claimId,
            startedAt: new Date(conversionStartMs).toISOString()
          });
          output = await convertClaimDocuments({
            claimId,
            documents,
            hospitalId,
            extractionEngine: engine,
            llmFallback
          });
          logInfo("conversion_completed", {
            jobId,
            claimId,
            bundlesCount: Array.isArray(output?.bundles) ? output.bundles.length : 0,
            validationStatus: output?.validationReport?.status || "unknown",
            durationMs: Date.now() - conversionStartMs
          });
        } catch (error) {
          logError("convert_claim_documents_failed", error, {
            claimId,
            hospitalId,
            documentsCount: Array.isArray(documents) ? documents.length : 0,
            durationMs: Date.now() - conversionStartMs
          });
          if (error?.code === "DOCUMENT_EXTRACTION_FAILED") {
            return {
              statusCode: 422,
              body: {
                error: "document_extraction_failed",
                details: {
                  fileName: error?.fileName || null,
                  reason: error?.reason || error?.message || "document_extraction_failed",
                  metadata: error?.metadata || null
                }
              }
            };
          }
          return { statusCode: 500, body: { error: "conversion_failed" } };
        }
        jobs.set(jobId, {
          status: "completed",
          createdAt: jobs.get(jobId).createdAt,
          completedAt: new Date().toISOString(),
          output
        });
        logInfo("job_completed", {
          jobId,
          claimId
        });

        return {
          statusCode: 200,
          body: {
            jobId,
            status: "completed",
            output
          }
        };
      }

      if (method === "GET" && normalizedUrl.startsWith("/v1/claims/convert/")) {
        const jobId = normalizedUrl.split("/").pop();
        const job = jobs.get(jobId);

        if (!job) {
          logInfo("job_not_found", { jobId });
          return { statusCode: 404, body: { error: "job_not_found" } };
        }
        logInfo("job_fetched", {
          jobId,
          status: job.status
        });

        return {
          statusCode: 200,
          body: {
            jobId,
            status: job.status,
            output: job.output
          }
        };
      }

      if (method === "GET" && normalizedUrl === "/health") {
        const healthPayload = { ok: true };
        if (typeof engine?.health === "function") {
          const health = await engine.health();
          healthPayload.ok = Boolean(health?.ok);
          healthPayload.ocr = health?.ocr || null;
        }
        logInfo("health_checked", {
          ok: healthPayload.ok,
          ocrOk: healthPayload?.ocr?.ok
        });
        return { statusCode: 200, body: healthPayload };
      }

      return { statusCode: 404, body: { error: "not_found" } };
    }
  };
}

export function createAppServer() {
  const api = createApiService();

  return http.createServer(async (req, res) => {
    const requestStartMs = Date.now();
    const requestPath = normalizePath(req.url) || req.url;
    const sendWithTiming = (statusCode, payload) => {
      sendJson(res, statusCode, payload);
      logInfo("response_sent", {
        method: req.method,
        url: requestPath,
        statusCode,
        durationMs: Date.now() - requestStartMs
      });
    };

    let body = {};
    let files = [];
    if (req.method === "POST") {
      const contentType = req.headers["content-type"] || "";
      if (contentType.startsWith("multipart/form-data")) {
        try {
          const raw = await readRawBody(req);
          const parsed = await parseMultipartFormData({
            contentType,
            rawBody: raw
          });
          body = parsed.fields;
          files = parsed.files;
          logInfo("multipart_parsed", {
            fieldsCount: Object.keys(body || {}).length,
            filesCount: Array.isArray(files) ? files.length : 0
          });
        } catch (error) {
          logError("parse_multipart_failed", error, {
            method: req.method,
            url: req.url
          });
          sendWithTiming(400, { error: "invalid_multipart" });
          return;
        }
      } else {
      try {
        body = await readJsonBody(req);
        logInfo("json_parsed", {
          keys: Object.keys(body || {})
        });
      } catch (error) {
        logError("parse_json_failed", error, {
          method: req.method,
          url: req.url
        });
        sendWithTiming(400, { error: "invalid_json" });
        return;
      }
      }
    }

    let response;
    try {
      response = await api.handle({
        method: req.method,
        url: req.url,
        body,
        files
      });
    } catch (error) {
      logError("unhandled_request_error", error, {
        method: req.method,
        url: req.url
      });
      sendWithTiming(500, { error: "internal_server_error" });
      return;
    }

    sendWithTiming(response.statusCode, response.body);
  });
}
