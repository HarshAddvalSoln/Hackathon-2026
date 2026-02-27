import test from "node:test";
import assert from "node:assert/strict";
import { convertClaimDocuments } from "../src/index.js";

test("pipeline auto-generates sha256 when not provided", async () => {
  const output = await convertClaimDocuments({
    claimId: "CLM-AUTOHASH-1",
    documents: [
      {
        fileName: "discharge-summary.pdf",
        text: "DISCHARGE SUMMARY\nPatient Name: Raj\nUHID: A1\nFinal Diagnosis: Fever"
      }
    ]
  });

  const docRef = output.bundles[0].entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "DocumentReference");

  assert.ok(docRef.identifier[0].value);
  assert.equal(docRef.identifier[0].value.length, 64);
  assert.equal(output.validationReport.status, "pass");
});
