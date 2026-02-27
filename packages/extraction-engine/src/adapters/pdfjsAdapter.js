import { readFile } from "node:fs/promises";

async function loadPdfjs() {
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return mod;
}

function logInfo(event, meta = {}) {
  // eslint-disable-next-line no-console
  console.log(`[pdfjs-adapter:info] ${event}`, meta);
}

function toPlainUint8Array(input) {
  // pdfjs-dist rejects Node Buffer; pass a plain Uint8Array view/copy.
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}

async function extractTextFromPdfData(pdfjsLib, data) {
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => item.str)
      .filter(Boolean)
      .join(" ")
      .trim();
    if (line) {
      pages.push(line);
    }
  }

  return pages.join("\n");
}

export function createPdfjsAdapter({ pdfjsLib, readFile: readFileImpl } = {}) {
  const readFileFn = readFileImpl || readFile;

  return {
    async extract(document) {
      if (typeof document.text === "string" && document.text.trim()) {
        logInfo("using_inline_text", {
          fileName: document?.fileName || null,
          textLength: document.text.trim().length
        });
        return {
          text: document.text,
          mode: "digital",
          metadata: {
            fileName: document.fileName
          }
        };
      }

      if (!document.filePath && !document.base64Pdf) {
        logInfo("no_digital_source", {
          fileName: document?.fileName || null
        });
        return {
          text: "",
          mode: "digital_empty",
          metadata: {
            fileName: document.fileName
          }
        };
      }

      const lib = pdfjsLib || (await loadPdfjs());
      let data;
      if (document.filePath) {
        logInfo("extracting_from_file_path", {
          fileName: document?.fileName || null,
          filePath: document.filePath
        });
        const fileBuffer = await readFileFn(document.filePath);
        data = toPlainUint8Array(fileBuffer);
      } else {
        logInfo("extracting_from_base64_pdf", {
          fileName: document?.fileName || null
        });
        const pdfBuffer = Buffer.from(document.base64Pdf, "base64");
        data = toPlainUint8Array(pdfBuffer);
      }
      const text = await extractTextFromPdfData(lib, data);
      logInfo("digital_extraction_completed", {
        fileName: document?.fileName || null,
        textLength: text.length
      });

      return {
        text,
        mode: "digital_pdfjs",
        metadata: {
          fileName: document.fileName,
          filePath: document.filePath || null,
          source: document.filePath ? "filePath" : "base64Pdf"
        }
      };
    }
  };
}
