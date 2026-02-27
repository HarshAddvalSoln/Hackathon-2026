/**
 * Extraction Service
 * Creates and manages extraction engine instances
 */

const { createLogger } = require('@hc-fhir/shared');
const { createExtractionEngine } = require('../../../../packages/extraction-engine/src/index');
const { createPdfjsAdapter } = require('../../../../packages/extraction-engine/src/adapters/pdfjsAdapter');
const { createDefaultOcrEngine } = require('../../ocr-worker/src/service');

const logger = createLogger('api:extraction-service');

/**
 * Create an OCR adapter that uses the in-process OCR engine
 * @param {Object} ocrEngine - OCR engine instance
 * @returns {Object} OCR adapter
 */
function createInProcessOcrAdapter(ocrEngine) {
  return {
    async extract(document) {
      const extracted = await ocrEngine.extract(document);
      return {
        text: extracted?.text || '',
        mode: 'ocr_inprocess',
        metadata: {
          confidence: extracted?.confidence ?? 0,
          diagnostics: extracted?.diagnostics || null,
        },
      };
    },
  };
}

/**
 * Create the default extraction engine with OCR
 * @returns {Object} Extraction engine
 */
function createDefaultExtractionEngine() {
  logger.info('Creating default extraction engine');

  const ocrEngine = createDefaultOcrEngine();
  const inProcessOcrAdapter = createInProcessOcrAdapter(ocrEngine);

  const engine = createExtractionEngine({
    digitalAdapter: createPdfjsAdapter(),
    ocrAdapter: inProcessOcrAdapter,
    ocrForAllPdfs: true,
  });

  return {
    ...engine,
    /**
     * Check health of extraction engine
     * @returns {Promise<Object>} Health status
     */
    async health() {
      if (typeof ocrEngine?.checkHealth !== 'function') {
        return { ok: true, ocr: { ok: 'unknown' } };
      }
      const ocrHealth = await ocrEngine.checkHealth();
      return {
        ok: Boolean(ocrHealth?.ok),
        ocr: ocrHealth,
      };
    },
  };
}

/**
 * Create extraction service with dependencies
 * @param {Object} options - Options
 * @param {Object} [options.ocrEngine] - Custom OCR engine
 * @returns {Object} Extraction service
 */
function createExtractionService(options = {}) {
  const { ocrEngine: customOcrEngine } = options;

  let extractionEngine = null;

  /**
   * Get or create extraction engine
   * @returns {Object} Extraction engine
   */
  function getEngine() {
    if (!extractionEngine) {
      if (customOcrEngine) {
        extractionEngine = createExtractionEngine({
          digitalAdapter: createPdfjsAdapter(),
          ocrAdapter: createInProcessOcrAdapter(customOcrEngine),
          ocrForAllPdfs: true,
        });
      } else {
        extractionEngine = createDefaultExtractionEngine();
      }
    }
    return extractionEngine;
  }

  return {
    getEngine,
    health: () => getEngine().health(),
  };
}

module.exports = {
  createDefaultExtractionEngine,
  createExtractionService,
  createInProcessOcrAdapter,
};
