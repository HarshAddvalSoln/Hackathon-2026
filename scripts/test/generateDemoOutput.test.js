import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateDemoOutput } from "../generate-demo-output.js";

test("generateDemoOutput writes bundle, compliance and extraction reports", async () => {
  const outputDir = path.resolve("test-data/demo-output");
  await generateDemoOutput({ outputDir });

  const bundlePath = path.join(outputDir, "bundle-1.json");
  const compliancePath = path.join(outputDir, "compliance-report.json");
  const extractionPath = path.join(outputDir, "extraction-report.json");

  assert.equal(fs.existsSync(bundlePath), true);
  assert.equal(fs.existsSync(compliancePath), true);
  assert.equal(fs.existsSync(extractionPath), true);
});
