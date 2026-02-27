import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("package scripts wire start:all to full demo launcher", async () => {
  const packageJsonRaw = await readFile(new URL("../../package.json", import.meta.url), "utf8");
  const packageJson = JSON.parse(packageJsonRaw);

  assert.equal(packageJson.scripts["start:all"], "node scripts/start-demo.js");
  assert.equal(packageJson.scripts["start:backend"], "node scripts/start-all.js");
  assert.equal(packageJson.scripts["start:frontend"], "npm --workspace @hackathon/frontend run dev");
});

test("start-demo script launches backend and frontend processes", async () => {
  const startDemoScript = await readFile(new URL("../start-demo.js", import.meta.url), "utf8");

  assert.match(startDemoScript, /loadDotEnv/);
  assert.match(startDemoScript, /scripts\/start-all\.js/);
  assert.match(startDemoScript, /@hackathon\/frontend/);
  assert.match(startDemoScript, /run", "dev"/);
});

test("start-all script loads env before launching services", async () => {
  const startAllScript = await readFile(new URL("../start-all.js", import.meta.url), "utf8");
  assert.match(startAllScript, /loadDotEnv/);
});
