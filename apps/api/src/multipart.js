import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function parseBoundary(contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  return match?.[1] || match?.[2] || null;
}

export async function parseMultipartFormData({
  contentType,
  rawBody,
  uploadRoot = "/tmp/hackathon-uploads"
}) {
  const boundary = parseBoundary(contentType);
  if (!boundary) {
    throw new Error("multipart boundary is missing");
  }

  await mkdir(uploadRoot, { recursive: true });

  const delimiter = `--${boundary}`;
  const body = rawBody.toString("latin1");
  const segments = body.split(delimiter).slice(1, -1);

  const fields = {};
  const files = [];

  for (const segment of segments) {
    const part = segment.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      continue;
    }

    const headerText = part.slice(0, headerEnd);
    const contentText = part.slice(headerEnd + 4);
    const content = contentText.endsWith("\r\n") ? contentText.slice(0, -2) : contentText;

    const dispositionLine = headerText
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-disposition"));
    if (!dispositionLine) {
      continue;
    }

    const nameMatch = /name="([^"]+)"/i.exec(dispositionLine);
    const fileNameMatch = /filename="([^"]*)"/i.exec(dispositionLine);
    const fieldName = nameMatch?.[1];
    if (!fieldName) {
      continue;
    }

    if (fileNameMatch && fileNameMatch[1]) {
      const originalName = path.basename(fileNameMatch[1]);
      const storedPath = path.join(uploadRoot, `${randomUUID()}-${originalName}`);
      const fileBuffer = Buffer.from(content, "latin1");
      await writeFile(storedPath, fileBuffer);
      files.push({
        fieldName,
        fileName: originalName,
        filePath: storedPath,
        size: fileBuffer.length
      });
      continue;
    }

    fields[fieldName] = content;
  }

  return { fields, files };
}
