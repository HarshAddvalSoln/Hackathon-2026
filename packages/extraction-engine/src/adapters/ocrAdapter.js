/**
 * OCR Adapter Interface
 * Defines the contract for OCR-based text extraction adapters
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('extraction-engine:ocr-adapter');

/**
 * Create an OCR extraction adapter
 * @param {Object} options - Adapter options
 * @param {string} [options.workerUrl='http://127.0.0.1:8081'] - OCR worker URL
 * @param {Function} [options.fetchImpl=fetch] - Fetch implementation
 * @returns {Object} OCR extraction adapter
 */
function createOcrAdapter({
  workerUrl = 'http://127.0.0.1:8081',
  fetchImpl = fetch,
} = {}) {
  return {
    /**
     * Extract text from a document using OCR
     * @param {Object} document - Document to extract from
     * @returns {Promise<Object>} Extraction result
     */
    async extract(document) {
      // Handle inline OCR text
      if (typeof document.ocrText === 'string' && document.ocrText.trim()) {
        logger.debug('Using inline OCR text', {
          fileName: document?.fileName || null,
          textLength: document.ocrText.trim().length,
        });
        return {
          text: document.ocrText,
          mode: 'ocr_inline',
          metadata: {
            fileName: document.fileName,
          },
        };
      }

      // Check for valid source
      if (!document.filePath && !document.base64Pdf && !document.imageBase64) {
        logger.debug('No OCR source provided', {
          fileName: document?.fileName || null,
        });
        return {
          text: '',
          mode: 'ocr_empty',
          metadata: {
            fileName: document.fileName,
          },
        };
      }

      logger.debug('Calling OCR worker', {
        fileName: document?.fileName || null,
        workerUrl,
      });

      try {
        const response = await fetchImpl(`${workerUrl}/ocr/extract`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            fileName: document.fileName,
            filePath: document.filePath,
            base64Pdf: document.base64Pdf,
            imageBase64: document.imageBase64,
          }),
        });

        if (!response.ok) {
          throw new Error(`OCR worker request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const text = typeof payload.text === 'string' ? payload.text : '';

        logger.debug('OCR worker response received', {
          fileName: document?.fileName || null,
          textLength: text.trim().length,
          confidence: payload?.confidence ?? null,
        });

        return {
          text,
          mode: 'ocr_worker',
          metadata: {
            fileName: document.fileName,
            confidence: payload.confidence,
            diagnostics: payload.diagnostics || null,
          },
        };
      } catch (error) {
        const isBackendUnreachable =
          error.message?.includes('connection') ||
          error.message?.includes('unreachable') ||
          error.code === 'ECONNREFUSED';

        logger.error('OCR extraction failed', {
          fileName: document?.fileName || null,
          error: error.message,
          isBackendUnreachable,
        });

        return {
          text: '',
          mode: 'ocr_error',
          metadata: {
            reason: error.message,
            diagnostics: {
              errors: [
                {
                  stage: isBackendUnreachable ? 'ocr_backend_unreachable' : 'ocr_processing',
                  message: error.message,
                },
              ],
            },
          },
        };
      }
    },
  };
}

export {
  createOcrAdapter,
};
