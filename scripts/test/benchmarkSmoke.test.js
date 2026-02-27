import test from "node:test";
import assert from "node:assert/strict";
import { runBenchmark } from "../benchmark.js";

test("benchmark returns metrics for batch conversion", async () => {
  const result = await runBenchmark({
    iterations: 5,
    documentsPerIteration: 2
  });

  assert.equal(result.iterations, 5);
  assert.equal(result.totalDocuments, 10);
  assert.ok(result.durationMs >= 0);
  assert.ok(result.docsPerSecond >= 0);
});
