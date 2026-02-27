import { spawn } from "node:child_process";
import { loadDotEnv } from "./load-env.js";

loadDotEnv();

function createProcess(command, args, name) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
  });

  child.on("error", (error) => {
    // eslint-disable-next-line no-console
    console.error(`[start-demo:error] ${name}`, error);
  });

  return child;
}

const backend = createProcess("node", ["scripts/start-all.js"], "backend");
const frontend = createProcess("npm", ["--workspace", "@hackathon/frontend", "run", "dev"], "frontend");

function shutdown(signal) {
  backend.kill(signal);
  frontend.kill(signal);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
