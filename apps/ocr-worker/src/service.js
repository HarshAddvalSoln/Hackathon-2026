import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildOcrPrompt } from './prompts/ocrPrompt.js';

function logError(event, error, meta = {}) {
  // eslint-disable-next-line no-console
  console.error(`[ocr-worker:error] ${event}`, {
    ...meta,
    message: error?.message,
    stack: error?.stack
  });
}

function logInfo(event, meta = {}) {
  // eslint-disable-next-line no-console
  console.log(`[ocr-worker:info] ${event}`, meta);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} failed (${code}): ${stderr || stdout}`));
    });
  });
}

async function withTempDir(prefix, fn, mkdtempImpl = mkdtemp, rmImpl = rm) {
  const dir = await mkdtempImpl(path.join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rmImpl(dir, { recursive: true, force: true });
  }
}

async function preparePdfPath(input, workDir, writeFileImpl = writeFile) {
  if (isNonEmptyString(input.filePath)) {
    return input.filePath;
  }
  if (isNonEmptyString(input.base64Pdf)) {
    const filePath = path.join(workDir, 'input.pdf');
    await writeFileImpl(filePath, Buffer.from(input.base64Pdf, 'base64'));
    return filePath;
  }
  return null;
}

async function prepareImagePath(input, workDir, writeFileImpl = writeFile) {
  if (isNonEmptyString(input.imageBase64)) {
    const filePath = path.join(workDir, 'input-image.png');
    await writeFileImpl(filePath, Buffer.from(input.imageBase64, 'base64'));
    return filePath;
  }
  return null;
}

async function pdfToImagePaths(
  pdfPath,
  workDir,
  runCommandImpl = runCommand,
  { maxPages = 5, dpi = 300 } = {}
) {
  const prefix = path.join(workDir, 'page');
  await runCommandImpl('pdftoppm', [
    '-r',
    String(dpi),
    '-gray',
    '-png',
    '-f',
    '1',
    '-l',
    String(maxPages),
    pdfPath,
    prefix
  ]);

  const files = await readdir(workDir);
  const pageFiles = files
    .map((fileName) => {
      const match = /^page-(\d+)\.png$/i.exec(fileName);
      if (!match) {
        return null;
      }
      return {
        page: Number(match[1]),
        filePath: path.join(workDir, fileName)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.page - b.page)
    .map((item) => item.filePath);

  return pageFiles;
}

function estimateConfidence(text) {
  const len = (text || '').trim().length;
  if (len === 0) {
    return 0;
  }
  if (len > 600) {
    return 0.9;
  }
  if (len > 200) {
    return 0.8;
  }
  if (len > 50) {
    return 0.65;
  }
  return 0.45;
}

function parseMedGemmaText(payload) {
  if (typeof payload?.message?.content === 'string') {
    return payload.message.content;
  }
  if (typeof payload?.response === 'string') {
    return payload.response;
  }
  return '';
}

async function mapWithConcurrency(items, concurrency, iterator) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 1);
  const results = new Array(list.length);
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await iterator(list[index], index);
    }
  }

  const workers = [];
  const workerCount = Math.min(limit, list.length);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value) {
  if (!isNonEmptyString(value)) {
    return 'http://127.0.0.1:11434';
  }
  return value.trim().replace(/\/+$/g, '');
}

function buildOllamaUrl(baseUrl, routePath) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  if (
    normalizedBase.toLowerCase().endsWith('/api') &&
    normalizedPath.toLowerCase().startsWith('/api/')
  ) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }
  return `${normalizedBase}${normalizedPath}`;
}

function isRetryableOcrError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('timed out') ||
    message.includes('network') ||
    message.includes('status 429') ||
    message.includes('status 500') ||
    message.includes('status 502') ||
    message.includes('status 503') ||
    message.includes('status 504')
  );
}

export function createMedGemmaOcrEngine({
  baseUrl = process.env.MEDGEMMA_BASE_URL || 'http://127.0.0.1:11434',
  model = process.env.MEDGEMMA_MODEL || 'dcarrascosa/medgemma-1.5-4b-it:Q8_0',
  maxPages = Number(process.env.OCR_MAX_PAGES || 5),
  pdfImageDpi = Number(process.env.OCR_PDF_DPI || 300),
  pageConcurrency = Number(process.env.OCR_PAGE_CONCURRENCY || 2),
  requestTimeoutMs = Number(process.env.MEDGEMMA_REQUEST_TIMEOUT_MS || 180000),
  pageRetries = Number(process.env.MEDGEMMA_PAGE_RETRIES || 2),
  fetchImpl = fetch,
  runCommandImpl = runCommand,
  readFileImpl = readFile
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  let modelCache = null;
  let tagsCache = null;
  let modeCache = 'chat';

  function normalizeModelName(value) {
    if (!isNonEmptyString(value)) {
      return '';
    }
    return value.trim().toLowerCase();
  }

  function toModelList(payload) {
    const models = Array.isArray(payload?.models) ? payload.models : [];
    return models
      .map((item) => (typeof item?.name === 'string' ? item.name.trim() : ''))
      .filter(Boolean);
  }

  function hasModel(models, targetModel) {
    const target = normalizeModelName(targetModel);
    if (!target) {
      return false;
    }
    return models.some((name) => normalizeModelName(name) === target);
  }

  function selectFallbackModel(models, configuredModel) {
    const normalizedConfigured = normalizeModelName(configuredModel);
    if (normalizedConfigured && hasModel(models, configuredModel)) {
      return configuredModel;
    }

    const candidates = ['medgemma:4b', 'medgemma', 'gemma3:4b', 'gemma3'];
    for (const candidate of candidates) {
      if (hasModel(models, candidate)) {
        return (
          models.find((name) => normalizeModelName(name) === normalizeModelName(candidate)) ||
          candidate
        );
      }
    }
    return models[0] || configuredModel;
  }

  async function fetchTags(forceRefresh = false) {
    if (!forceRefresh && tagsCache) {
      return tagsCache;
    }
    const response = await fetchImpl(buildOllamaUrl(normalizedBaseUrl, '/api/tags'), {
      method: 'GET'
    });
    if (!response.ok) {
      throw new Error(`status_${response.status}`);
    }
    const payload = await response.json();
    const models = toModelList(payload);
    tagsCache = { models };
    return tagsCache;
  }

  async function resolveOperationalModel(forceRefresh = false) {
    if (!forceRefresh && modelCache) {
      return modelCache;
    }
    try {
      const tags = await fetchTags(forceRefresh);
      const selected = selectFallbackModel(tags.models, model);
      modelCache = selected;
      return selected;
    } catch {
      modelCache = model;
      return model;
    }
  }

  async function checkHealth() {
    logInfo('health_check_started', {
      baseUrl: normalizedBaseUrl,
      model
    });
    try {
      const tags = await fetchTags(true);
      const selectedModel = selectFallbackModel(tags.models, model);
      const configuredModelExists = hasModel(tags.models, model);
      if (!selectedModel) {
        return {
          ok: false,
          baseUrl: normalizedBaseUrl,
          model,
          error: 'model_not_available'
        };
      }
      modelCache = selectedModel;
      logInfo('health_check_completed', {
        ok: configuredModelExists || Boolean(selectedModel),
        effectiveModel: selectedModel
      });
      return {
        ok: configuredModelExists || Boolean(selectedModel),
        baseUrl: normalizedBaseUrl,
        model,
        effectiveModel: selectedModel,
        modelFallback: !configuredModelExists && selectedModel !== model
      };
    } catch (error) {
      logInfo('health_check_failed', {
        baseUrl: normalizedBaseUrl,
        model,
        error: error?.message || 'health_check_failed'
      });
      return {
        ok: false,
        baseUrl: normalizedBaseUrl,
        model,
        error: error?.message || 'health_check_failed'
      };
    }
  }

  function toStatusError(response, responseDetails, endpointUrl, mode) {
    const statusError = new Error(
      responseDetails
        ? `MedGemma OCR request failed (status ${response.status}, mode ${mode}, endpoint ${endpointUrl}): ${responseDetails}`
        : `MedGemma OCR request failed (status ${response.status}, mode ${mode}, endpoint ${endpointUrl})`
    );
    statusError.status = response.status;
    statusError.responseDetails = responseDetails;
    statusError.endpointUrl = endpointUrl;
    statusError.mode = mode;
    return statusError;
  }

  async function parseResponse(response) {
    const raw = await response.text();
    if (!isNonEmptyString(raw)) {
      return { payload: null, raw: '' };
    }
    try {
      return { payload: JSON.parse(raw), raw };
    } catch {
      return { payload: null, raw };
    }
  }

  function isModelMissingError(error) {
    const message = String(error?.responseDetails || error?.message || '').toLowerCase();
    if (!message.includes('model')) {
      return false;
    }
    return message.includes('not found') || message.includes('pull');
  }

  function getModeOrder() {
    return modeCache === 'generate' ? ['generate', 'chat'] : ['chat', 'generate'];
  }

  function normalizeImageList(images) {
    if (Array.isArray(images)) {
      return images.filter((item) => isNonEmptyString(item));
    }
    if (isNonEmptyString(images)) {
      return [images];
    }
    return [];
  }

  function buildModePayload(mode, activeModel, images) {
    const normalizedImages = normalizeImageList(images);

    // Get prompt from prompts file
    const instruction = buildOcrPrompt(normalizedImages.length);

    const payload =
      mode === 'generate'
        ? {
            model: activeModel,
            stream: false,
            options: { temperature: 0 },
            prompt: instruction,
            images: normalizedImages
          }
        : {
            model: activeModel,
            stream: false,
            options: { temperature: 0 },
            messages: [
              {
                role: 'user',
                content: instruction,
                images: normalizedImages
              }
            ]
          };

    console.log('[medgemma] Prompt being sent to LLM (first 200 chars):', instruction);
    console.log('[medgemma] Model:', activeModel);
    console.log('[medgemma] Images count:', normalizedImages.length);
    console.log('[medgemma] Payload:', {
      ...payload
    });

    return payload;
  }

  async function ocrRequestWithMode({ mode, activeModel, images, signal }) {
    const route = mode === 'generate' ? '/api/generate' : '/api/chat';
    const endpointUrl = buildOllamaUrl(normalizedBaseUrl, route);
    console.log(
      `[medgemma] Making OCR request to ${endpointUrl} with mode ${mode} and model ${activeModel}`
    );
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(buildModePayload(mode, activeModel, images))
    });
    const { payload, raw } = await parseResponse(response);
    if (!response.ok) {
      const responseDetails = isNonEmptyString(payload?.error)
        ? payload.error.trim()
        : String(raw || '').trim();
      throw toStatusError(response, responseDetails, endpointUrl, mode);
    }
    if (payload) {
      const extracted = parseMedGemmaText(payload);
      modeCache = mode;
      return typeof extracted === 'string' ? extracted.trim() : '';
    }
    const text = String(raw || '').trim();
    modeCache = mode;
    return text;
  }

  async function ocrWithMedGemmaImages(images) {
    // Handle single image (string) or array of images
    let normalizedImages;
    if (typeof images === 'string' && images.trim()) {
      normalizedImages = [images];
    } else {
      normalizedImages = normalizeImageList(images);
    }

    if (normalizedImages.length === 0) {
      return '';
    }
    const attempts = Math.max(1, pageRetries + 1);
    let lastError = null;
    let activeModel = await resolveOperationalModel(false);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      logInfo('ocr_request_attempt_started', {
        attempt,
        attempts,
        activeModel
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        let lastModeError = null;
        for (const mode of getModeOrder()) {
          try {
            return await ocrRequestWithMode({
              mode,
              activeModel,
              images: normalizedImages,
              signal: controller.signal
            });
          } catch (error) {
            lastModeError = error;
            if (error?.status === 404 && mode === 'chat' && !isModelMissingError(error)) {
              continue;
            }
            throw error;
          }
        }
        throw lastModeError || new Error('MedGemma OCR request failed');
      } catch (error) {
        const wrapped =
          error?.name === 'AbortError'
            ? new Error(`MedGemma OCR request timed out after ${requestTimeoutMs}ms`)
            : error;
        lastError = wrapped;

        if (isModelMissingError(wrapped)) {
          const fallbackModel = await resolveOperationalModel(true);
          if (
            isNonEmptyString(fallbackModel) &&
            fallbackModel !== activeModel &&
            attempt < attempts
          ) {
            activeModel = fallbackModel;
            continue;
          }
        }

        const retryable = isRetryableOcrError(wrapped);
        if (attempt < attempts && retryable) {
          logInfo('ocr_request_retrying', {
            attempt,
            reason: wrapped?.message || 'retryable_error'
          });
          await delay(Math.min(600 * attempt, 2000));
          continue;
        }
        throw wrapped;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error('MedGemma OCR request failed');
  }

  return {
    checkHealth,
    async extract(input) {
      logInfo('extract_started', {
        hasFilePath: isNonEmptyString(input?.filePath),
        hasBase64Pdf: isNonEmptyString(input?.base64Pdf),
        hasImageBase64: isNonEmptyString(input?.imageBase64),
        maxPages,
        pageConcurrency
      });
      const diagnostics = {
        engine: 'medgemma',
        baseUrl: normalizedBaseUrl,
        model,
        errors: []
      };
      return withTempDir('medgemma-ocr-', async (workDir) => {
        try {
          diagnostics.effectiveModel = await resolveOperationalModel(false);
          const pdfPath = await preparePdfPath(input, workDir);
          if (pdfPath) {
            logInfo('pdf_detected_for_ocr', {
              pdfPath
            });
            const imagePaths = await pdfToImagePaths(pdfPath, workDir, runCommandImpl, {
              maxPages,
              dpi: pdfImageDpi
            });
            logInfo('pdf_converted_to_images', {
              pdfPath,
              pagesGenerated: imagePaths.length
            });
            if (imagePaths.length === 0) {
              const error = new Error('No PNG pages generated from PDF');
              logError('pdf_to_image_no_pages', error, {
                pdfPath
              });
              diagnostics.errors.push({
                stage: 'pdf_to_image',
                message: error.message
              });
              return { text: '', confidence: 0, diagnostics };
            }

            const imagePayloads = await mapWithConcurrency(
              imagePaths,
              Math.max(1, pageConcurrency),
              async (imagePath) => {
                const bytes = await readFileImpl(imagePath);
                return Buffer.from(bytes).toString('base64');
              }
            );

            let text = '';
            try {
              logInfo('pdf_batch_ocr_started', {
                pagesTried: imagePayloads.length
              });
              // Process images one by one
              const pageTexts = [];
              for (let i = 0; i < imagePayloads.length; i++) {
                logInfo('pdf_page_ocr_started', {
                  pageNumber: i + 1,
                  totalPages: imagePayloads.length
                });
                const pageText = await ocrWithMedGemmaImages(imagePayloads[i]);
                pageTexts.push(pageText);
                logInfo('pdf_page_ocr_completed', {
                  pageNumber: i + 1,
                  textLength: pageText.trim().length
                });
              }
              text = pageTexts.join('\n---PAGE BREAK---\n');
              logInfo('pdf_batch_ocr_completed', {
                pagesTried: imagePayloads.length,
                textLength: text.trim().length
              });
            } catch (error) {
              logError('pdf_batch_ocr_failed', error, {
                pagesTried: imagePayloads.length
              });
              diagnostics.errors.push({
                stage: 'pdf_batch_ocr',
                message: error?.message || 'pdf_batch_ocr_failed',
                pagesTried: imagePayloads.length
              });
            }

            if (isNonEmptyString(text)) {
              diagnostics.effectiveModel = modelCache || diagnostics.effectiveModel;
              return { text, confidence: estimateConfidence(text), diagnostics };
            }

            logInfo('pdf_batch_ocr_empty_fallback_to_page_ocr', {
              pagesTried: imagePaths.length
            });

            const pageResults = await mapWithConcurrency(
              imagePaths,
              Math.max(1, pageConcurrency),
              async (imagePath, index) => {
                try {
                  const bytes = await readFileImpl(imagePath);
                  const image64 = Buffer.from(bytes).toString('base64');
                  const pageText = await ocrWithMedGemmaImages(image64);
                  return {
                    index,
                    imagePath,
                    text: pageText || '',
                    error: null
                  };
                } catch (error) {
                  logError('medgemma_page_ocr_failed', error, {
                    imagePath
                  });
                  return {
                    index,
                    imagePath,
                    text: '',
                    error
                  };
                }
              }
            );

            let unreachableCount = 0;
            const pageTexts = [];
            for (const result of pageResults) {
              if (result?.error) {
                if (isRetryableOcrError(result.error)) {
                  unreachableCount += 1;
                }
                diagnostics.errors.push({
                  stage: 'page_ocr',
                  imagePath: result.imagePath,
                  message: result.error?.message || 'page_ocr_failed'
                });
              }
              if (isNonEmptyString(result?.text)) {
                pageTexts.push({
                  index: result.index,
                  text: result.text
                });
              }
            }

            text = pageTexts
              .sort((a, b) => a.index - b.index)
              .map((item) => item.text)
              .join('\n');
            if (!text.trim()) {
              const error = new Error('No OCR text extracted from generated pages');
              logError('medgemma_pdf_empty_text', error, {
                pdfPath,
                pagesTried: imagePaths.length
              });
              diagnostics.errors.push({
                stage: 'pdf_ocr',
                message: error.message,
                pagesTried: imagePaths.length
              });
            }
            if (unreachableCount === imagePaths.length && imagePaths.length > 0) {
              diagnostics.errors.push({
                stage: 'ocr_backend_unreachable',
                message: `Unable to reach MedGemma endpoint at ${baseUrl}`
              });
            }
            diagnostics.effectiveModel = modelCache || diagnostics.effectiveModel;
            logInfo('pdf_ocr_completed', {
              pdfPath,
              textLength: text.trim().length,
              pagesWithText: pageTexts.length,
              pagesTried: imagePaths.length
            });
            return { text, confidence: estimateConfidence(text), diagnostics };
          }

          const imagePath = await prepareImagePath(input, workDir);
          if (imagePath) {
            logInfo('image_detected_for_ocr', {
              imagePath
            });
            const bytes = await readFileImpl(imagePath);
            const image64 = Buffer.from(bytes).toString('base64');
            const text = await ocrWithMedGemmaImages(image64);
            diagnostics.effectiveModel = modelCache || diagnostics.effectiveModel;
            logInfo('image_ocr_completed', {
              textLength: text.trim().length
            });
            return { text, confidence: estimateConfidence(text), diagnostics };
          }

          if (isNonEmptyString(input.filePath)) {
            logInfo('direct_file_ocr_started', {
              filePath: input.filePath
            });
            const bytes = await readFileImpl(input.filePath);
            const image64 = Buffer.from(bytes).toString('base64');
            const text = await ocrWithMedGemmaImages(image64);
            diagnostics.effectiveModel = modelCache || diagnostics.effectiveModel;
            logInfo('direct_file_ocr_completed', {
              filePath: input.filePath,
              textLength: text.trim().length
            });
            return { text, confidence: estimateConfidence(text), diagnostics };
          }

          diagnostics.errors.push({
            stage: 'input_validation',
            message: 'No usable filePath/base64Pdf/imageBase64 input provided'
          });
          return { text: '', confidence: 0, diagnostics };
        } catch (error) {
          logError('medgemma_extract_failed', error, {
            hasFilePath: isNonEmptyString(input?.filePath),
            hasBase64Pdf: isNonEmptyString(input?.base64Pdf),
            hasImageBase64: isNonEmptyString(input?.imageBase64)
          });
          diagnostics.errors.push({
            stage: 'extract',
            message: error?.message || 'medgemma_extract_failed'
          });
          logInfo('extract_failed', {
            message: error?.message || 'medgemma_extract_failed'
          });
          return { text: '', confidence: 0, diagnostics };
        }
      });
    }
  };
}

export function createDefaultOcrEngine() {
  return createMedGemmaOcrEngine();
}

export function createOcrWorkerService({ ocrEngine } = {}) {
  const engine = ocrEngine || createDefaultOcrEngine();

  return {
    async handle({ method, url, body }) {
      logInfo('service_request_received', { method, url });
      if (method === 'GET' && url === '/health') {
        if (typeof engine?.checkHealth !== 'function') {
          return { statusCode: 200, body: { ok: true, ocr: { ok: 'unknown' } } };
        }
        const health = await engine.checkHealth();
        logInfo('service_health_completed', {
          ok: Boolean(health?.ok)
        });
        return {
          statusCode: 200,
          body: {
            ok: Boolean(health?.ok),
            ocr: health
          }
        };
      }

      if (method === 'POST' && url === '/ocr/extract') {
        const hasValidInput =
          isNonEmptyString(body?.filePath) ||
          isNonEmptyString(body?.base64Pdf) ||
          isNonEmptyString(body?.imageBase64);
        if (!hasValidInput) {
          return {
            statusCode: 400,
            body: {
              error: 'invalid_request',
              details: 'filePath or base64Pdf or imageBase64 is required'
            }
          };
        }

        const extracted = await engine.extract(body);
        logInfo('service_ocr_extract_completed', {
          textLength: (extracted?.text || '').trim().length,
          confidence: extracted?.confidence ?? 0
        });
        return {
          statusCode: 200,
          body: {
            text: extracted.text || '',
            confidence: extracted.confidence ?? 0,
            diagnostics: extracted.diagnostics || null
          }
        };
      }

      return { statusCode: 404, body: { error: 'not_found' } };
    }
  };
}
