/**
 * OCR Engine using Tesseract.js
 * Fast OCR engine for text extraction from images and PDFs
 */

import Tesseract from 'tesseract.js';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

let tesseractWorker = null;

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

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

async function getTesseractWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker('eng', 1, {
      logger: () => {}
    });
  }
  return tesseractWorker;
}

async function convertPdfToImages(pdfPath, workDir, maxPages = 5) {
  const prefix = path.join(workDir, 'page');
  await runCommand('pdftoppm', [
    '-r', '300',
    '-gray',
    '-png',
    '-f', '1',
    '-l', String(maxPages),
    pdfPath,
    prefix
  ]);

  const files = await readdir(workDir);
  return files
    .filter(f => f.endsWith('.png'))
    .map(f => ({ page: parseInt(f.match(/-(\d+)\.png$/)?.[1] || '0', 10), path: path.join(workDir, f) }))
    .sort((a, b) => a.page - b.page)
    .map(f => f.path);
}

function calculateConfidence(data) {
  if (!data?.confidence) return 0;
  return Math.round(data.confidence * 100) / 100;
}

function formatOcrResults(result) {
  if (!result?.data?.text) return '';
  return result.data.text.trim();
}

export function createTesseractOcrEngine() {
  let healthChecked = false;
  let healthStatus = { ok: false, error: null };

  return {
    async checkHealth() {
      if (healthChecked) return healthStatus;

      try {
        await getTesseractWorker();
        healthStatus = { ok: true, engine: 'tesseract' };
      } catch (err) {
        healthStatus = { ok: false, error: err.message, engine: 'tesseract' };
      }
      healthChecked = true;
      return healthStatus;
    },

    async extract(body) {
      const { filePath, base64Pdf, imageBase64 } = body;

      try {
        const workDir = await mkdtemp(path.join(tmpdir(), 'tesseract-ocr-'));
        let imagePaths = [];

        if (filePath?.endsWith('.pdf')) {
          imagePaths = await convertPdfToImages(filePath, workDir);
        } else if (base64Pdf) {
          const pdfPath = path.join(workDir, 'input.pdf');
          await writeFile(pdfPath, Buffer.from(base64Pdf, 'base64'));
          imagePaths = await convertPdfToImages(pdfPath, workDir);
        } else if (imageBase64) {
          const imagePath = path.join(workDir, 'input.png');
          await writeFile(imagePath, Buffer.from(imageBase64, 'base64'));
          imagePaths = [imagePath];
        } else if (filePath) {
          imagePaths = [filePath];
        }

        if (imagePaths.length === 0) {
          throw new Error('No valid input provided');
        }

        const worker = await getTesseractWorker();
        const texts = [];
        const confidences = [];

        for (const imagePath of imagePaths) {
          const result = await worker.recognize(imagePath);
          texts.push(formatOcrResults(result));
          confidences.push(calculateConfidence(result.data));
        }

        const text = texts.join('\n---PAGE BREAK---\n');
        const avgConfidence = confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0.8;

        return {
          text,
          confidence: Math.round(avgConfidence * 100) / 100,
          diagnostics: {
            engine: 'tesseract',
            pages: imagePaths.length,
            textLength: text.length
          }
        };
      } catch (err) {
        console.log('[tesseract] Error, trying MedGemma fallback:', err.message);

        try {
          const { createMedGemmaOcrEngine } = await import('./service.js');
          const fallbackEngine = createMedGemmaOcrEngine();
          const fallbackResult = await fallbackEngine.extract(body);
          return {
            ...fallbackResult,
            diagnostics: {
              ...fallbackResult.diagnostics,
              fallbackFrom: 'tesseract'
            }
          };
        } catch (fallbackErr) {
          throw err;
        }
      }
    }
  };
}
