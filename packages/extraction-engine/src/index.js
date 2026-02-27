/**
 * Extraction Engine
 * Main orchestrator for PDF text extraction with digital and OCR fallback
 */

import { createLogger } from '@hc-fhir/shared';
import { ensureAdapter, ensureText, hasOcrBackendUnreachable, buildAttempts } from './adapters/index.js';

const logger = createLogger('extraction-engine');

/**
 * Create an extraction engine instance
 * @param {Object} options - Engine options
 * @param {Object} options.digitalAdapter - Digital text extraction adapter
 * @param {Object} options.ocrAdapter - OCR extraction adapter
 * @param {boolean} [options.ocrForAllPdfs=false] - Force OCR for all PDFs
 * @returns {Object} Extraction engine instance
 */
function createExtractionEngine({ digitalAdapter, ocrAdapter, ocrForAllPdfs = false }) {
  ensureAdapter(digitalAdapter, 'digitalAdapter');
  ensureAdapter(ocrAdapter, 'ocrAdapter');

  return {
    /**
     * Extract text from a document
     * @param {Object} document - Document to extract from
     * @returns {Promise<Object>} Extraction result
     */
    async extract(document) {
      const hasPdfOrImageInput =
        Boolean(document?.filePath) || Boolean(document?.base64Pdf) || Boolean(document?.imageBase64);

      logger.info('Extraction started', {
        fileName: document?.fileName || null,
        hasPdfOrImageInput,
        ocrForAllPdfs,
        hasTextLayer: document?.hasTextLayer,
      });

      // OCR-first mode
      if (ocrForAllPdfs && hasPdfOrImageInput) {
        return extractOcrFirst(document, ocrAdapter, digitalAdapter, logger);
      }

      // Scan-only mode (explicit hint to skip digital)
      if (document.hasTextLayer === false) {
        return extractScanOnly(document, ocrAdapter, logger);
      }

      // Default: digital-first with OCR fallback
      return extractDigitalFirst(document, digitalAdapter, ocrAdapter, logger);
    },
  };
}

/**
 * Extract using OCR-first strategy
 */
async function extractOcrFirst(document, ocrAdapter, digitalAdapter, logger) {
  logger.debug('OCR-first mode', { fileName: document?.fileName || null });

  const ocrResult = await ocrAdapter.extract(document);
  const ocrText = ensureText(ocrResult);

  if (ocrText) {
    logger.info('OCR-first: OCR success', {
      fileName: document?.fileName || null,
      mode: ocrResult?.mode || 'ocr_unknown',
      textLength: ocrText.length,
    });
    return ocrResult;
  }

  // Fallback to digital
  const digitalResult = await digitalAdapter.extract(document);
  const digitalText = ensureText(digitalResult);

  if (digitalText) {
    logger.info('OCR-first: fallback to digital success', {
      fileName: document?.fileName || null,
      digitalMode: digitalResult?.mode || 'digital_unknown',
      textLength: digitalText.length,
    });
    return {
      ...digitalResult,
      metadata: {
        ...(digitalResult?.metadata || {}),
        fallback: {
          from: ocrResult?.mode || 'ocr_unknown',
          reason: hasOcrBackendUnreachable(ocrResult) ? 'ocr_backend_unreachable' : 'ocr_empty_text',
          ocrDiagnostics: ocrResult?.metadata?.diagnostics || null,
        },
      },
    };
  }

  // Both failed
  if (hasOcrBackendUnreachable(ocrResult)) {
    logger.error('OCR-first: OCR backend unreachable, fatal', {
      fileName: document?.fileName || null,
    });
    return {
      text: '',
      mode: 'extraction_failed',
      metadata: {
        reason: 'ocr_backend_unreachable_no_text_fallback',
        fatal: true,
        attempts: buildAttempts(ocrResult, ocrText, digitalResult, digitalText),
      },
    };
  }

  return {
    text: '',
    mode: 'extraction_empty',
    metadata: {
      reason: 'no_text_from_ocr_or_digital',
      attempts: buildAttempts(ocrResult, ocrText, digitalResult, digitalText),
    },
  };
}

/**
 * Extract using scan-only (OCR only) strategy
 */
async function extractScanOnly(document, ocrAdapter, logger) {
  logger.debug('Scan-only mode', { fileName: document?.fileName || null });

  const ocrResult = await ocrAdapter.extract(document);
  const ocrText = ensureText(ocrResult);

  if (ocrText || !hasOcrBackendUnreachable(ocrResult)) {
    logger.info('Scan-only: OCR result', {
      fileName: document?.fileName || null,
      mode: ocrResult?.mode || 'ocr_unknown',
      textLength: ocrText.length,
    });
    return ocrResult;
  }

  logger.error('Scan-only: OCR backend unreachable, fatal', {
    fileName: document?.fileName || null,
  });

  return {
    text: '',
    mode: 'extraction_failed',
    metadata: {
      reason: 'scan_requires_ocr_backend_unreachable',
      fatal: true,
      attempts: [
        {
          mode: ocrResult?.mode || 'ocr_unknown',
          textLength: 0,
          diagnostics: ocrResult?.metadata?.diagnostics || null,
        },
      ],
    },
  };
}

/**
 * Extract using digital-first with OCR fallback strategy
 */
async function extractDigitalFirst(document, digitalAdapter, ocrAdapter, logger) {
  // Try digital first
  const digitalResult = await digitalAdapter.extract(document);
  const text = ensureText(digitalResult);

  if (text) {
    logger.info('Digital-first: digital success', {
      fileName: document?.fileName || null,
      mode: digitalResult?.mode || 'digital_unknown',
      textLength: text.length,
    });
    return digitalResult;
  }

  // Fallback to OCR
  logger.debug('Digital-first: digital empty, falling back to OCR', {
    fileName: document?.fileName || null,
  });

  const ocrResult = await ocrAdapter.extract(document);
  const ocrText = ensureText(ocrResult);

  if (ocrText) {
    logger.info('Digital-first: OCR fallback success', {
      fileName: document?.fileName || null,
      mode: ocrResult?.mode || 'ocr_unknown',
      textLength: ocrText.length,
    });
    return ocrResult;
  }

  // Both failed
  if (hasOcrBackendUnreachable(ocrResult)) {
    return {
      text: '',
      mode: 'extraction_failed',
      metadata: {
        reason: 'ocr_backend_unreachable_no_text_fallback',
        fatal: true,
        attempts: buildAttempts(ocrResult, ocrText, digitalResult, text),
      },
    };
  }

  return {
    text: '',
    mode: 'extraction_empty',
    metadata: {
      reason: 'no_text_from_digital_or_ocr',
      attempts: [
        {
          mode: digitalResult?.mode || 'digital_unknown',
          textLength: text.length,
          diagnostics: digitalResult?.metadata?.diagnostics || null,
        },
        {
          mode: ocrResult?.mode || 'ocr_unknown',
          textLength: ocrText.length,
          diagnostics: ocrResult?.metadata?.diagnostics || null,
        },
      ],
    },
  };
}

export {
  createExtractionEngine,
};
