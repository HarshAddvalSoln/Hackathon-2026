import http from "node:http";
import { createOcrWorkerService } from "./service.js";
import { loadDotEnv } from "../../../scripts/load-env.js";

loadDotEnv();

function logError(event, error, meta = {}) {
  // eslint-disable-next-line no-console
  console.error(`[ocr-worker:error] ${event}`, {
    ...meta,
    message: error?.message,
    stack: error?.stack
  });
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function createOcrWorkerServer() {
  const service = createOcrWorkerService();
  return http.createServer(async (req, res) => {
    let body = {};
    if (req.method === "POST") {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        logError("parse_json_failed", error, {
          method: req.method,
          url: req.url
        });
        sendJson(res, 400, { error: "invalid_json" });
        return;
      }
    }

    let response;
    try {
      response = await service.handle({
        method: req.method,
        url: req.url,
        body
      });
    } catch (error) {
      logError("service_handle_failed", error, {
        method: req.method,
        url: req.url
      });
      sendJson(res, 500, { error: "internal_server_error" });
      return;
    }

    sendJson(res, response.statusCode, response.body);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.OCR_WORKER_PORT || 8081);
  const server = createOcrWorkerServer();
  server.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`OCR worker listening on ${port}`);
  });
}
