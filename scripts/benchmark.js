import { performance } from "node:perf_hooks";
import { convertClaimDocuments } from "../packages/pipeline/src/index.js";

function makeDocument(index) {
  return {
    fileName: `discharge-${index}.pdf`,
    sha256: `hash-${index}`,
    text: `DISCHARGE SUMMARY
Patient Name: Patient ${index}
UHID: HSP-${index}
Final Diagnosis: Viral Fever`
  };
}

export async function runBenchmark({ iterations = 10, documentsPerIteration = 2 }) {
  const startedAt = performance.now();
  let totalDocuments = 0;

  for (let i = 0; i < iterations; i += 1) {
    const documents = Array.from({ length: documentsPerIteration }, (_, docIndex) =>
      makeDocument(i * documentsPerIteration + docIndex + 1)
    );
    await convertClaimDocuments({
      claimId: `CLM-BENCH-${i + 1}`,
      hospitalId: "default",
      documents
    });
    totalDocuments += documents.length;
  }

  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  const docsPerSecond = durationMs === 0 ? 0 : Number(((totalDocuments * 1000) / durationMs).toFixed(2));

  return {
    iterations,
    totalDocuments,
    durationMs,
    docsPerSecond
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark({ iterations: 50, documentsPerIteration: 2 }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}
