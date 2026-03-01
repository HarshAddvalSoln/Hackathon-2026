/**
 * PaddleOCR Engine
 * Fast OCR engine using PaddlePaddle for text extraction
 */

import { readFile } from 'node:fs/promises';
import { PaddleOCR } from 'paddleocr';
import { createMedGemmaOcrEngine } from './service.js';

let paddleOcr = null;

function getPaddleOcr() {
  if (!paddleOcr) {
    paddleOcr = new PaddleOCR({
      lang: 'en',
      use_angle_cls: true,
      use_gpu: false,
      show_log: false
    });
  }
  return paddleOcr;
}

function calculateConfidence(results) {
  if (!results || results.length === 0) return 0;

  const confidences = results
    .map(page => page.map(line => line[1]?.[1] ?? 0))
    .flat()
    .filter(Boolean);

  if (confidences.length === 0) return 0;

  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  return Math.round(avg * 100) / 100;
}

function formatOcrResults(results) {
  if (!results || results.length === 0) return '';

  return results
    .map(page => page.map(line => line[1]?.[0] ?? '').filter(Boolean).join('\n'))
    .join('\n---PAGE BREAK---\n');
}

export function createPaddleOcrEngine() {
  let healthChecked = false;
  let healthStatus = { ok: false, error: null };

  return {
    async checkHealth() {
      if (healthChecked) return healthStatus;

      try {
        const ocr = getPaddleOcr();
        // Test with a simple check - PaddleOCR doesn't have a ping method
        // so we just verify the module loads
        healthStatus = { ok: true, engine: 'paddleocr' };
      } catch (err) {
        healthStatus = { ok: false, error: err.message, engine: 'paddleocr' };
      }
      healthChecked = true;
      return healthStatus;
    },

    async extract(body) {
      const { filePath, base64Pdf, imageBase64, useFallback } = body;

      if (useFallback) {
        const fallbackEngine = createMedGemmaOcrEngine();
        return fallbackEngine.extract(body);
      }

      try {
        let imagePath = filePath;

        if (!imagePath && base64Pdf) {
          // For PDFs, we need to convert first - use existing logic
          // For now, return an error asking for images
          throw new Error('PDF conversion not supported in PaddleOCR mode. Use imageBase64 or provide imagePath.');
        }

        if (!imagePath && imageBase64) {
          const { writeFile, mkdtemp } = await import('node:fs/promises');
          const { tmpdir } = await import('node:os');
          const path = await import('node:path');

          const workDir = await mkdtemp(path.join(tmpdir(), 'paddle-ocr-'));
          imagePath = path.join(workDir, 'input.png');
          await writeFile(imagePath, Buffer.from(imageBase64, 'base64'));
        }

        if (!imagePath) {
          throw new Error('No valid input provided');
        }

        const ocr = getPaddleOcr();
        const results = await ocr.ocr(imagePath, { cls: true });

        const text = formatOcrResults(results);
        const confidence = calculateConfidence(results);

        return {
          text,
          confidence,
          diagnostics: {
            engine: 'paddleocr',
            pages: results?.length ?? 0,
            textLength: text.length
          }
        };
      } catch (err) {
        // On error, try fallback to MedGemma
        console.log('[paddleocr] Error, trying MedGemma fallback:', err.message);

        try {
          const fallbackEngine = createMedGemmaOcrEngine();
          const fallbackResult = await fallbackEngine.extract(body);
          return {
            ...fallbackResult,
            diagnostics: {
              ...fallbackResult.diagnostics,
              fallbackFrom: 'paddleocr'
            }
          };
        } catch (fallbackErr) {
          throw err;
        }
      }
    }
  };
}
