/**
 * Custom error class for document extraction failures
 */

/**
 * Error thrown when document extraction fails
 * @extends Error
 */
class ExtractionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} details - Additional error details
   */
  constructor(message, code = 'EXTRACTION_ERROR', details = {}) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.details = details;
    this.fileName = details.fileName || null;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtractionError);
    }
  }

  /**
   * Convert error to JSON for logging
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      fileName: this.fileName,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

module.exports = ExtractionError;
