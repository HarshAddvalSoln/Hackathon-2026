/**
 * Request Validators
 * Validates incoming API requests
 */

const { createLogger } = require('@hc-fhir/shared');

const logger = createLogger('api:validators');

/**
 * Validate convert request
 * @param {Object} body - Request body
 * @returns {Object} Validation result
 */
function validateConvertRequest(body) {
  const errors = [];

  // Validate documents
  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    errors.push({
      field: 'documents',
      message: 'documents must be a non-empty array',
    });
  } else {
    body.documents.forEach((doc, index) => {
      if (!doc || typeof doc !== 'object') {
        errors.push({
          field: `documents[${index}]`,
          message: 'must be an object',
        });
      }
      if (!doc.fileName || typeof doc.fileName !== 'string') {
        errors.push({
          field: `documents[${index}].fileName`,
          message: 'fileName is required',
        });
      }
    });
  }

  // Validate claimId if provided
  if (body.claimId !== undefined) {
    if (typeof body.claimId !== 'string') {
      errors.push({
        field: 'claimId',
        message: 'claimId must be a string',
      });
    }
  }

  // Validate hospitalId if provided
  if (body.hospitalId !== undefined) {
    if (typeof body.hospitalId !== 'string') {
      errors.push({
        field: 'hospitalId',
        message: 'hospitalId must be a string',
      });
    }
  }

  const ok = errors.length === 0;

  if (!ok) {
    logger.debug('Request validation failed', { errors });
  }

  return {
    ok,
    details: errors,
  };
}

/**
 * Validate job ID format
 * @param {string} jobId - Job ID
 * @returns {boolean} True if valid
 */
function isValidJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    return false;
  }
  // Basic UUID or string format check
  return jobId.length > 0 && jobId.length <= 255;
}

module.exports = {
  validateConvertRequest,
  isValidJobId,
};
