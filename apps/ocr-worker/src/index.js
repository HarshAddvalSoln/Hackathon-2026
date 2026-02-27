/**
 * OCR Worker
 * OCR processing worker using MedGemma for text extraction
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('ocr-worker');

// Re-export main service
import { createDefaultOcrEngine } from './service.js';

export {
  createDefaultOcrEngine,
  logger,
};
