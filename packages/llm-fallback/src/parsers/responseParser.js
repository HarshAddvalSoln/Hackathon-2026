/**
 * Response Parser
 * Parses and sanitizes LLM responses
 */

import { createLogger, normalizationUtils } from '@hc-fhir/shared';
const { normalizeHiType } = normalizationUtils;

const logger = createLogger('llm-fallback:parser');

/**
 * Check if value is a non-empty string
 * @param {*} value - Value to check
 * @returns {boolean} True if non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse Ollama response content
 * @param {Object} payload - Ollama response payload
 * @returns {string} Parsed content
 */
function parseOllamaContent(payload) {
  if (typeof payload?.message?.content === 'string') {
    return payload.message.content;
  }
  if (payload?.message?.content && typeof payload.message.content === 'object') {
    try {
      return JSON.stringify(payload.message.content);
    } catch {
      return '';
    }
  }
  if (typeof payload?.response === 'string') {
    return payload.response;
  }
  if (payload?.response && typeof payload.response === 'object') {
    try {
      return JSON.stringify(payload.response);
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Strip code fences from response
 * @param {string} value - Response value
 * @returns {string} Stripped value
 */
function stripCodeFence(value) {
  if (!isNonEmptyString(value)) {
    return '';
  }
  const trimmed = value.trim();
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  return trimmed;
}

/**
 * Safely parse JSON with fallback
 * @param {string} raw - Raw JSON string
 * @returns {Object|null} Parsed object or null
 */
function safeJsonParse(raw) {
  if (!isNonEmptyString(raw)) {
    return null;
  }

  const stripped = stripCodeFence(raw);

  // Try direct parse first
  try {
    return JSON.parse(stripped);
  } catch {
    // Try coarse extraction - find first and last braces
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Get string or null
 * @param {*} value - Value to sanitize
 * @returns {string|null} Sanitized value
 */
function asStringOrNull(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

/**
 * Sanitize an observation object
 * @param {Object} item - Observation item
 * @returns {Object|null} Sanitized observation or null
 */
function sanitizeObservation(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const name = asStringOrNull(item.name);
  const value = asStringOrNull(item.value);
  const unit = asStringOrNull(item.unit);

  if (!name || !value) {
    return null;
  }

  return { name, value, unit: unit || '' };
}

/**
 * Sanitize the full LLM response payload
 * @param {Object} payload - Raw LLM response
 * @returns {Object|null} Sanitized payload or null
 */
function sanitizeFallbackPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const extractedData = payload.extracted || payload;
  const hiType = normalizeHiType(payload.hiType);

  const extracted = {
    patientName: asStringOrNull(extractedData.patientName),
    patientLocalId: asStringOrNull(extractedData.patientLocalId),
    patientGender: asStringOrNull(extractedData.patientGender),
    patientDob: asStringOrNull(extractedData.patientDob),
    patientAddress: asStringOrNull(extractedData.patientAddress),
    hospitalName: asStringOrNull(extractedData.hospitalName),
    hospitalAddress: asStringOrNull(extractedData.hospitalAddress),
    attendingPhysician: asStringOrNull(extractedData.attendingPhysician),
    physicianRegNo: asStringOrNull(extractedData.physicianRegNo),
    admissionDate: asStringOrNull(extractedData.admissionDate),
    dischargeDate: asStringOrNull(extractedData.dischargeDate),
    finalDiagnosis: asStringOrNull(extractedData.finalDiagnosis),
    chiefComplaint: asStringOrNull(extractedData.chiefComplaint),
    procedureDone: asStringOrNull(extractedData.procedureDone),
    medications: asStringOrNull(extractedData.medications),
    testName: asStringOrNull(extractedData.testName),
    resultValue: asStringOrNull(extractedData.resultValue),
    observationDate: asStringOrNull(extractedData.observationDate),
    interpretation: asStringOrNull(extractedData.interpretation),
    payerName: asStringOrNull(extractedData.payerName),
    policyNumber: asStringOrNull(extractedData.policyNumber),
    memberId: asStringOrNull(extractedData.memberId),
    observations: Array.isArray(extractedData.observations)
      ? extractedData.observations.map(sanitizeObservation).filter(Boolean).slice(0, 25)
      : [],
  };

  return { hiType, extracted };
}

/**
 * Parse LLM response to structured data
 * @param {Object} params - Parameters
 * @param {Object} params.payload - Ollama response payload
 * @param {Object} params.options - Parse options
 * @returns {Object|null} Parsed and sanitized data
 */
function parseResponse({ payload, options = {} }) {
  const rawContent = parseOllamaContent(payload);

  logger.debug('Parsing LLM response', {
    rawContentLength: rawContent?.length || 0,
  });

  if (!rawContent) {
    logger.warn('No content in LLM response');
    return null;
  }

  const parsed = safeJsonParse(rawContent);

  if (!parsed) {
    logger.warn('Failed to parse LLM response as JSON');
    return null;
  }

  const sanitized = sanitizeFallbackPayload(parsed);

  if (!sanitized) {
    logger.warn('Failed to sanitize LLM payload');
    return null;
  }

  return {
    hiType: sanitized.hiType,
    extracted: sanitized.extracted,
  };
}

export {
  isNonEmptyString,
  parseOllamaContent,
  stripCodeFence,
  safeJsonParse,
  asStringOrNull,
  sanitizeObservation,
  sanitizeFallbackPayload,
  parseResponse,
};
