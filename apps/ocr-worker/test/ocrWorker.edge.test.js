import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createDefaultOcrEngine, createMedGemmaOcrEngine, createOcrWorkerService } from "../src/service.js";

function responseFromJson(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

test("OCR worker health endpoint", async () => {
  const service = createOcrWorkerService({
    ocrEngine: {
      async checkHealth() {
        return {
          ok: true,
          baseUrl: "http://127.0.0.1:11434",
          model: "medgemma:4b"
        };
      }
    }
  });
  const response = await service.handle({ method: "GET", url: "/health", body: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.ocr.model, "medgemma:4b");
});

test("OCR worker supports base64 image input", async () => {
  const service = createOcrWorkerService({
    ocrEngine: {
      async extract(input) {
        return { text: input.imageBase64.slice(0, 5), confidence: 0.33 };
      }
    }
  });

  const response = await service.handle({
    method: "POST",
    url: "/ocr/extract",
    body: { imageBase64: "abcdef" }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.text, "abcde");
});

test("OCR worker returns not_found on unknown route", async () => {
  const service = createOcrWorkerService();
  const response = await service.handle({ method: "GET", url: "/none", body: {} });
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, "not_found");
});

test("createDefaultOcrEngine selects medgemma", () => {
  const engine = createDefaultOcrEngine({ engineName: "medgemma" });
  assert.equal(typeof engine.extract, "function");
});

test("MedGemma engine parses chat response content", async () => {
  const engine = createMedGemmaOcrEngine({
    fetchImpl: async () => responseFromJson({ message: { content: "DISCHARGE SUMMARY" } })
  });

  const out = await engine.extract({ imageBase64: Buffer.from("fakeimg").toString("base64") });
  assert.equal(out.text, "DISCHARGE SUMMARY");
  assert.ok(out.confidence > 0);
});

test("MedGemma engine OCRs only generated PDF pages", async () => {
  let fetchCallCount = 0;
  let chatCallCount = 0;
  let seenRunArgs = [];
  const engine = createMedGemmaOcrEngine({
    fetchImpl: async (url) => {
      fetchCallCount += 1;
      if (url.endsWith("/api/tags")) {
        return responseFromJson({ models: [{ name: "medgemma:4b" }] });
      }
      chatCallCount += 1;
      return responseFromJson({ message: { content: "PAGE OCR TEXT" } });
    },
    runCommandImpl: async (_command, args) => {
      seenRunArgs = args;
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "PAGE OCR TEXT");
  assert.equal(chatCallCount, 1);
  assert.ok(fetchCallCount >= 2);
  assert.ok(seenRunArgs.includes("-r"));
  assert.ok(seenRunArgs.includes("-gray"));
});

test("MedGemma engine health reports connectivity failure", async () => {
  const engine = createMedGemmaOcrEngine({
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    }
  });

  const health = await engine.checkHealth();
  assert.equal(health.ok, false);
  assert.match(health.error, /ECONNREFUSED/);
});

test("MedGemma engine health falls back to available model when configured model is missing", async () => {
  const engine = createMedGemmaOcrEngine({
    model: "medgemma:4b",
    fetchImpl: async () => responseFromJson({
      models: [{ name: "gemma3:4b" }]
    })
  });

  const health = await engine.checkHealth();
  assert.equal(health.ok, true);
  assert.equal(health.modelFallback, true);
  assert.equal(health.effectiveModel, "gemma3:4b");
});

test("MedGemma engine retries transient page OCR failures", async () => {
  let attempts = 0;
  const engine = createMedGemmaOcrEngine({
    pageRetries: 2,
    requestTimeoutMs: 2000,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("fetch failed");
      }
      return responseFromJson({ message: { content: "RECOVERED OCR" } });
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "RECOVERED OCR");
  assert.equal(attempts, 2);
});

test("MedGemma engine marks backend unreachable when all pages fail to connect", async () => {
  const engine = createMedGemmaOcrEngine({
    pageRetries: 0,
    requestTimeoutMs: 1000,
    fetchImpl: async () => {
      throw new Error("fetch failed");
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "");
  assert.ok(Array.isArray(out.diagnostics.errors));
  assert.ok(out.diagnostics.errors.some((item) => item.stage === "ocr_backend_unreachable"));
});

test("MedGemma engine preserves page order under concurrent OCR", async () => {
  const engine = createMedGemmaOcrEngine({
    pageConcurrency: 2,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      const images = payload.messages?.[0]?.images || payload.images || [];
      if (images.length > 1) {
        return responseFromJson({ message: { content: "   " } });
      }
      const raw = Buffer.from(images[0], "base64").toString("utf8");
      if (raw === "page-1.png") {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      return responseFromJson({ message: { content: raw } });
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "x");
      await writeFile(`${outputPrefix}-2.png`, "y");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async (imagePath) => Buffer.from(path.basename(imagePath), "utf8")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "page-1.png\npage-2.png");
});

test("MedGemma engine retries with available model after 404 model-not-found", async () => {
  let chatCalls = 0;
  let tagsCalls = 0;
  const engine = createMedGemmaOcrEngine({
    model: "medgemma:4b",
    pageRetries: 1,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/api/tags")) {
        tagsCalls += 1;
        return {
          ...responseFromJson(
            tagsCalls === 1
              ? { models: [{ name: "medgemma:4b" }] }
              : { models: [{ name: "gemma3:4b" }] }
          )
        };
      }

      chatCalls += 1;
      const payload = JSON.parse(options.body);
      if (chatCalls === 1) {
        assert.equal(payload.model, "medgemma:4b");
        return {
          ...responseFromJson(
            { error: "model 'medgemma:4b' not found, try pulling it first" },
            { ok: false, status: 404 }
          )
        };
      }
      assert.equal(payload.model, "gemma3:4b");
      return responseFromJson({ message: { content: "OCR OK" } });
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "OCR OK");
  assert.equal(out.diagnostics.effectiveModel, "gemma3:4b");
  assert.equal(chatCalls, 2);
});

test("MedGemma engine falls back to /api/generate when /api/chat is missing", async () => {
  let chatCalls = 0;
  let generateCalls = 0;
  const engine = createMedGemmaOcrEngine({
    pageRetries: 0,
    fetchImpl: async (url) => {
      if (url.endsWith("/api/tags")) {
        return responseFromJson({ models: [{ name: "gemma3:4b" }] });
      }
      if (url.endsWith("/api/chat")) {
        chatCalls += 1;
        return responseFromJson({ error: "not found" }, { ok: false, status: 404 });
      }
      if (url.endsWith("/api/generate")) {
        generateCalls += 1;
        return responseFromJson({ response: "OCR FROM GENERATE" });
      }
      throw new Error(`unexpected url ${url}`);
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "OCR FROM GENERATE");
  assert.equal(chatCalls, 1);
  assert.equal(generateCalls, 1);
});

test("MedGemma engine normalizes baseUrl ending with /api", async () => {
  const seenUrls = [];
  const engine = createMedGemmaOcrEngine({
    baseUrl: "http://127.0.0.1:11434/api",
    fetchImpl: async (url) => {
      seenUrls.push(url);
      if (url.endsWith("/api/tags")) {
        return responseFromJson({ models: [{ name: "gemma3:4b" }] });
      }
      if (url.endsWith("/api/chat")) {
        return responseFromJson({ message: { content: "OCR OK" } });
      }
      throw new Error(`unexpected url ${url}`);
    },
    runCommandImpl: async (_command, args) => {
      const outputPrefix = args[args.length - 1];
      await writeFile(`${outputPrefix}-1.png`, "fake-image");
      return { stdout: "", stderr: "" };
    },
    readFileImpl: async () => Buffer.from("fake-image")
  });

  const out = await engine.extract({
    base64Pdf: Buffer.from("fake-pdf").toString("base64")
  });

  assert.equal(out.text, "OCR OK");
  assert.ok(seenUrls.every((url) => !url.includes("/api/api/")));
});
