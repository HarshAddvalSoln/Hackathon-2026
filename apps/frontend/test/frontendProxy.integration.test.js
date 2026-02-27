import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("frontend vite proxy targets backend API routes", async () => {
  const configContent = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");

  assert.match(configContent, /"\/v1"\s*:\s*"http:\/\/127\.0\.0\.1:3000"/);
  assert.match(configContent, /"\/health"\s*:\s*"http:\/\/127\.0\.0\.1:3000"/);
});
