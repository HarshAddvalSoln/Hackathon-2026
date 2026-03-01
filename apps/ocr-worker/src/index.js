/**
 * OCR Worker
 * OCR processing worker using Tesseract.js (primary) or MedGemma (fallback)
 */

import { createLogger } from '@hc-fhir/shared';
import { createDefaultOcrEngine } from './service.js';
import { createTesseractOcrEngine } from './tesseractOcrEngine.js';

const logger = createLogger('ocr-worker');

export {
  createDefaultOcrEngine,
  createTesseractOcrEngine,
  logger,
};
