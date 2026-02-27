import fs from "node:fs/promises";
import path from "node:path";
import { convertClaimDocuments } from "../packages/pipeline/src/index.js";

export async function generateDemoOutput({ outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });

  const output = await convertClaimDocuments({
    claimId: "CLM-DEMO-1",
    hospitalId: "hsp-alpha",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        sha256: "demo-hash-discharge",
        text: `DISCHARGE SUMMARY
Patient Name: Raj Mehta
IP No: ALPHA-1001
Date of Admission: 2026-02-20
Date of Discharge: 2026-02-23
Diagnosis at Discharge: Viral Fever`
      },
      {
        fileName: "diagnostic-report.pdf",
        sha256: "demo-hash-lab",
        text: `DIAGNOSTIC REPORT
Patient Name: Raj Mehta
IP No: ALPHA-1001
Investigation: Hemoglobin
Test Result: 12.4 g/dL
Report Date: 2026-02-22`
      }
    ]
  });

  await fs.writeFile(path.join(outputDir, "bundle-1.json"), JSON.stringify(output.bundles[0], null, 2));
  await fs.writeFile(path.join(outputDir, "bundle-2.json"), JSON.stringify(output.bundles[1], null, 2));
  await fs.writeFile(
    path.join(outputDir, "compliance-report.json"),
    JSON.stringify(output.complianceReport, null, 2)
  );
  await fs.writeFile(
    path.join(outputDir, "extraction-report.json"),
    JSON.stringify(output.extractionReports, null, 2)
  );

  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputDir = path.resolve("test-data/demo-output");
  generateDemoOutput({ outputDir }).then(() => {
    console.log(`Demo output generated at ${outputDir}`);
  });
}
