/**
 * Custom error class for LLM enrichment failures
 */

/**
 * Error thrown when LLM enrichment fails
 * @extends Error
 */
class EnrichmentError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'EnrichmentError';
    this.code = 'ENRICHMENT_ERROR';
    this.details = details;
    this.retryable = details.retryable !== undefined ? details.retryable : true;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnrichmentError);
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
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

export default EnrichmentError;
