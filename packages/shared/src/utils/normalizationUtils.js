/**
 * String normalization utilities for clinical data processing
 */

const TITLE_TOKENS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'madam',
  'mr.', 'mrs.', 'ms.', 'miss.', 'dr.', 'prof.', 'sir.', 'madam.',
]);

const INVALID_TOKENS = new Set([
  'na', 'n/a', 'nil', 'none', 'unknown', 'unknown', 'not', 'available',
  'data', 'not Applicable', 'not', 'specified',
]);

/**
 * Normalize a token for comparison
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove non-alphanumeric characters
 * @param {string} token - Token to normalize
 * @returns {string} Normalized token
 */
function normalizeToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  return token
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize a patient name for matching
 * @param {string} name - Patient name
 * @returns {string} Normalized name
 */
function normalizePatientName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(token => !TITLE_TOKENS.has(token) && !INVALID_TOKENS.has(token))
    .join(' ')
    .replace(/[^a-z\s]/g, '');
}

/**
 * Normalize a patient ID for matching
 * @param {string} id - Patient ID
 * @returns {string} Normalized ID
 */
function normalizePatientId(id) {
  if (!id || typeof id !== 'string') {
    return '';
  }

  return id
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalize a HI type string to known values
 * @param {string} hiType - HI type string
 * @returns {string} Normalized HI type
 */
function normalizeHiType(hiType) {
  if (!hiType || typeof hiType !== 'string') {
    return 'unknown';
  }

  const normalized = hiType.trim().toLowerCase();

  // Map common variations
  const hiTypeMap = {
    'hospitalization': 'hospitalization',
    'hospitalisation': 'hospitalization',
    'room rent': 'room_rent',
    'roomrent': 'room_rent',
    'icu': 'icu',
    'icc': 'icu',
    'nicu': 'nicu',
    'premium': 'premium',
    'sublimit': 'sublimit',
    'co-pay': 'copay',
    'copay': 'copay',
    'co payment': 'copay',
    'deductible': 'deductible',
    'consumables': 'consumables',
    'medicine': 'medicine',
    'medications': 'medicine',
    'investigation': 'investigation',
    'investigations': 'investigation',
    'diagnostics': 'investigation',
    'surgery': 'surgery',
    'surgical': 'surgery',
    'operation': 'surgery',
    'procedure': 'procedure',
    'procedures': 'procedure',
    'treatment': 'treatment',
    ' therapies': 'treatment',
    'ayush': 'ayush',
    'alternative': 'ayush',
    'homeopathy': 'homeopathy',
    'ayurveda': 'ayurveda',
    'unani': 'unani',
    'yoga': 'yoga',
    'physiotherapy': 'physiotherapy',
    'therapy': 'physiotherapy',
    'ambulance': 'ambulance',
    'transport': 'ambulance',
    'dental': 'dental',
    'dental treatment': 'dental',
    'vision': 'vision',
    'optical': 'vision',
    'maternity': 'maternity',
    'delivery': 'maternity',
    'birth': 'maternity',
    'newborn': 'newborn',
    'neonate': 'newborn',
    'vaccination': 'vaccination',
    'vaccine': 'vaccination',
    'immunization': 'vaccination',
    'health checkup': 'health_checkup',
    'health check': 'health_checkup',
    'preventive': 'health_checkup',
    'wellness': 'health_checkup',
    'prevention': 'health_checkup',
  };

  for (const [key, value] of Object.entries(hiTypeMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Return original if no mapping found
  return normalized.replace(/[^a-z0-9]/g, '_');
}

/**
 * Normalize a gender string
 * @param {string} gender - Gender string
 * @returns {string} Normalized gender (male/female/other/unknown)
 */
function normalizeGender(gender) {
  if (!gender || typeof gender !== 'string') {
    return 'unknown';
  }

  const normalized = normalizeToken(gender);

  if (['m', 'male', 'man', 'boy'].includes(normalized)) {
    return 'male';
  }
  if (['f', 'female', 'woman', 'girl'].includes(normalized)) {
    return 'female';
  }
  if (['o', 'other', 'others'].includes(normalized)) {
    return 'other';
  }

  return 'unknown';
}

/**
 * Normalize a phone number
 * @param {string} phone - Phone number
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  return phone
    .trim()
    .replace(/[^+0-9]/g, '');
}

/**
 * Normalize an email address
 * @param {string} email - Email address
 * @returns {string} Normalized email
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

/**
 * Check if a token is a valid name token
 * @param {string} token - Token to check
 * @returns {boolean} True if valid name token
 */
function isValidNameToken(token) {
  if (!token || token.length < 2) {
    return false;
  }
  return !TITLE_TOKENS.has(token) && !INVALID_TOKENS.has(token);
}

/**
 * Check if a string contains valid name content
 * @param {string} str - String to check
 * @returns {boolean} True if contains name content
 */
function hasNameContent(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const tokens = str.trim().toLowerCase().split(/\s+/);
  return tokens.some(token => isValidNameToken(token));
}

module.exports = {
  normalizeToken,
  normalizePatientName,
  normalizePatientId,
  normalizeHiType,
  normalizeGender,
  normalizePhone,
  normalizeEmail,
  isValidNameToken,
  hasNameContent,
  TITLE_TOKENS,
  INVALID_TOKENS,
};
