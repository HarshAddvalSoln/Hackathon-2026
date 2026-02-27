import test from "node:test";
import assert from "node:assert/strict";
import { parseMultipartFormData } from "../src/multipart.js";

test("parseMultipartFormData extracts fields and files", async () => {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const payload =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="claimId"\r\n\r\n` +
    `CLM-MP-1\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="sample.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n` +
    `PDFDATA\r\n` +
    `--${boundary}--\r\n`;

  const result = await parseMultipartFormData({
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.from(payload, "latin1")
  });

  assert.equal(result.fields.claimId, "CLM-MP-1");
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].fileName, "sample.pdf");
  assert.ok(result.files[0].filePath.includes("sample.pdf"));
});
