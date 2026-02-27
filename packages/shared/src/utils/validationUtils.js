/**
 * Common validation utilities
 */

/**
 * Check if a value is a non-empty string
 * @param {*} value - Value to check
 * @returns {boolean} True if non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is a valid email
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Check if a value is a valid phone number
 * @param {string} phone - Phone to validate
 * @returns {boolean} True if valid phone format
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Remove common formatting characters and check
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Check if a value is a valid date string
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  const date = new Date(dateStr.trim());
  return !isNaN(date.getTime());
}

/**
 * Check if a number is within range
 * @param {number} value - Number to check
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} True if within range
 */
function isInRange(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }
  return value >= min && value <= max;
}

/**
 * Check if an object has required properties
 * @param {Object} obj - Object to check
 * @param {string[]} requiredProps - Array of required property names
 * @returns {Object} Result with isValid and missingProps
 */
function hasRequiredProperties(obj, requiredProps) {
  if (!obj || typeof obj !== 'object') {
    return { isValid: false, missingProps: [...requiredProps] };
  }

  const missingProps = requiredProps.filter(prop => {
    const value = obj[prop];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  return {
    isValid: missingProps.length === 0,
    missingProps,
  };
}

/**
 * Validate an array is non-empty
 * @param {Array} arr - Array to validate
 * @returns {boolean} True if non-empty array
 */
function isNonEmptyArray(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Check if a string matches a pattern
 * @param {string} str - String to check
 * @param {RegExp} pattern - Pattern to match
 * @returns {boolean} True if matches pattern
 */
function matchesPattern(str, pattern) {
  if (!str || typeof str !== 'string' || !pattern) {
    return false;
  }
  return pattern.test(str);
}

/**
 * Validate document object structure
 * @param {Object} doc - Document object
 * @returns {Object} Result with isValid and errors
 */
function validateDocument(doc) {
  const errors = [];

  if (!doc) {
    return { isValid: false, errors: ['Document is required'] };
  }

  if (!isNonEmptyString(doc.fileName)) {
    errors.push('fileName is required');
  }

  // Check for content - either base64 or text
  if (!isNonEmptyString(doc.content) && !isNonEmptyString(doc.base64)) {
    errors.push('Either content or base64 is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate claim data structure
 * @param {Object} claim - Claim data
 * @returns {Object} Result with isValid and errors
 */
function validateClaimData(claim) {
  const errors = [];

  if (!claim) {
    return { isValid: false, errors: ['Claim data is required'] };
  }

  const { isValid: hasDocs, missingProps: docProps } = hasRequiredProperties(claim, ['documents']);
  if (!hasDocs) {
    errors.push(`Missing required properties: ${docProps.join(', ')}`);
  }

  if (claim.documents && !isNonEmptyArray(claim.documents)) {
    errors.push('documents must be a non-empty array');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidPhone,
  isValidDateString,
  isInRange,
  hasRequiredProperties,
  isNonEmptyArray,
  matchesPattern,
  validateDocument,
  validateClaimData,
};
