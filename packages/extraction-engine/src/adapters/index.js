/**
 * Base adapter interface for extraction engines
 * Defines the contract that all adapters must implement
 */

/**
 * Base adapter interface
 * @interface ExtractionAdapter
 */

/**
 * Extract text from a document
 * @function extract
 * @param {Object} document - Document to extract from
 * @param {string} [document.filePath] - Path to file
 * @param {string} [document.base64Pdf] - Base64 encoded PDF
 * @param {string} [document.imageBase64] - Base64 encoded image
 * @param {string} [document.fileName] - Original file name
 * @param {boolean} [document.hasTextLayer] - Whether PDF has text layer
 * @returns {Promise<Object>} Extraction result with text and metadata
 */

/**
 * Validate that an adapter implements the required interface
 * @param {Object} adapter - Adapter to validate
 * @param {string} name - Adapter name for error messages
 * @throws {Error} If adapter doesn't implement required methods
 */
function ensureAdapter(adapter, name) {
  if (!adapter || typeof adapter.extract !== 'function') {
    throw new Error(`${name} must expose extract(document) method`);
  }
}

/**
 * Ensure extraction result has text
 * @param {Object} result - Extraction result
 * @returns {string} Text content or empty string
 */
function ensureText(result) {
  return (result?.text || '').trim();
}

/**
 * Check if OCR backend is unreachable
 * @param {Object} result - Extraction result
 * @returns {boolean} True if OCR backend is unreachable
 */
function hasOcrBackendUnreachable(result) {
  const errors = result?.metadata?.diagnostics?.errors;
  if (!Array.isArray(errors)) {
    return false;
  }
  return errors.some((error) => error?.stage === 'ocr_backend_unreachable');
}

/**
 * Build attempts array for metadata
 * @param {Object} ocrResult - OCR extraction result
 * @param {string} ocrText - OCR extracted text
 * @param {Object} digitalResult - Digital extraction result
 * @param {string} digitalText - Digital extracted text
 * @returns {Object[]} Attempts array
 */
function buildAttempts(ocrResult, ocrText, digitalResult, digitalText) {
  return [
    {
      mode: ocrResult?.mode || 'ocr_unknown',
      textLength: ocrText.length,
      diagnostics: ocrResult?.metadata?.diagnostics || null,
    },
    {
      mode: digitalResult?.mode || 'digital_unknown',
      textLength: digitalText.length,
      diagnostics: digitalResult?.metadata?.diagnostics || null,
    },
  ];
}

export {
  ensureAdapter,
  ensureText,
  hasOcrBackendUnreachable,
  buildAttempts,
};
