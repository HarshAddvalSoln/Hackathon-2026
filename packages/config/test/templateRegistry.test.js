import test from "node:test";
import assert from "node:assert/strict";
import { getHospitalTemplate } from "../src/index.js";

test("returns default template", () => {
  const template = getHospitalTemplate();
  assert.equal(template.id, "default");
  assert.ok(template.extractors.discharge_summary.patientLocalId.length > 0);
});
