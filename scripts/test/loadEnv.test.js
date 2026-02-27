import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadDotEnv } from "../load-env.js";

test("loadDotEnv loads .env from parent directories", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dotenv-load-"));
  const nested = path.join(root, "a", "b");
  await mkdir(nested, { recursive: true });
  await writeFile(
    path.join(root, ".env"),
    "MEDGEMMA_BASE_URL=http://127.0.0.1:11434\nMEDGEMMA_MODEL=gemma3:4b\n"
  );

  const oldBaseUrl = process.env.MEDGEMMA_BASE_URL;
  const oldModel = process.env.MEDGEMMA_MODEL;
  delete process.env.MEDGEMMA_BASE_URL;
  delete process.env.MEDGEMMA_MODEL;

  try {
    const loadedPath = loadDotEnv({ cwd: nested });
    assert.equal(loadedPath, path.join(root, ".env"));
    assert.equal(process.env.MEDGEMMA_BASE_URL, "http://127.0.0.1:11434");
    assert.equal(process.env.MEDGEMMA_MODEL, "gemma3:4b");
  } finally {
    if (oldBaseUrl === undefined) {
      delete process.env.MEDGEMMA_BASE_URL;
    } else {
      process.env.MEDGEMMA_BASE_URL = oldBaseUrl;
    }
    if (oldModel === undefined) {
      delete process.env.MEDGEMMA_MODEL;
    } else {
      process.env.MEDGEMMA_MODEL = oldModel;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("loadDotEnv does not override existing environment variables", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "dotenv-preserve-"));
  await writeFile(path.join(root, ".env"), "MEDGEMMA_MODEL=medgemma:4b\n");

  const oldModel = process.env.MEDGEMMA_MODEL;
  process.env.MEDGEMMA_MODEL = "gemma3:4b";

  try {
    loadDotEnv({ cwd: root });
    assert.equal(process.env.MEDGEMMA_MODEL, "gemma3:4b");
  } finally {
    if (oldModel === undefined) {
      delete process.env.MEDGEMMA_MODEL;
    } else {
      process.env.MEDGEMMA_MODEL = oldModel;
    }
    await rm(root, { recursive: true, force: true });
  }
});
