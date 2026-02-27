import { createAppServer } from "../apps/api/src/server.js";
import { createOcrWorkerServer } from "../apps/ocr-worker/src/server.js";
import { loadDotEnv } from "./load-env.js";

loadDotEnv();

const apiPort = Number(process.env.API_PORT || 3000);
const ocrPort = Number(process.env.OCR_WORKER_PORT || 8081);
const host = process.env.HOST || "127.0.0.1";

const apiServer = createAppServer();
const ocrServer = createOcrWorkerServer();

function startServer(server, name, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`${name} running at http://${host}:${port}`);
      resolve();
    });
  });
}

function shutdown() {
  // eslint-disable-next-line no-console
  console.log("Shutting down servers...");
  apiServer.close();
  ocrServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await startServer(ocrServer, "OCR worker", ocrPort);
await startServer(apiServer, "API", apiPort);
