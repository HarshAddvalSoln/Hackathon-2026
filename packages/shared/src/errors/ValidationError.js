/**
 * Custom error class for validation failures
 */

/**
 * Error thrown when input validation fails
 * @extends Error
 */
class ValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.details = details;
    this.validationErrors = details.validationErrors || [];
    this.field = details.field || null;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Create validation error from field errors
   * @param {string} field - Field that failed validation
   * @param {string} message - Error message
   * @param {*} value - Invalid value
   * @returns {ValidationError}
   */
  static forField(field, message, value) {
    return new ValidationError(message, {
      field,
      validationErrors: [{ field, message, value }],
    });
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
      validationErrors: this.validationErrors,
      field: this.field,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

module.exports = ValidationError;
