import test from "node:test";
import assert from "node:assert/strict";
import { runBenchmark } from "../benchmark.js";

test("benchmark handles zero iterations", async () => {
  const result = await runBenchmark({
    iterations: 0,
    documentsPerIteration: 3
  });

  assert.equal(result.iterations, 0);
  assert.equal(result.totalDocuments, 0);
  assert.ok(result.durationMs >= 0);
  assert.equal(result.docsPerSecond, 0);
});
