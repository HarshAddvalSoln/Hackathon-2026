/**
 * Patient FHIR Resource Builder
 * Creates NHCX-compliant Patient resources
 */

import { createLogger, normalizationUtils, dateUtils } from '@hc-fhir/shared';
const { normalizeToken, normalizePatientName, normalizePatientId, normalizeGender } = normalizationUtils;
const { toFhirDate } = dateUtils;

const logger = createLogger('fhir-mapper:Patient');

const EXAMPLE_HSP_SYSTEM = 'https://example-hsp.local';

const TITLE_TOKENS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'kumari', 'baby', 'master']);
const INVALID_TOKENS = new Set(['unknown', 'na', 'n/a', 'null', 'undefined', 'age', 'gender', 'id', 'name']);

/**
 * Resolve patient name from extracted data
 * @param {string} name - Patient name
 * @returns {Object} Resolved name with inference flag
 */
function resolvePatientName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    logger.debug('Patient name: missing/invalid, inferring "Unknown Patient"');
    return { value: 'Unknown Patient', inferred: true, field: 'name' };
  }

  const cleaned = name.trim().replace(/\s+/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const nonTitleTokens = tokens.filter((token) => !TITLE_TOKENS.has(normalizeToken(token)));
  const hasMeaningfulToken = nonTitleTokens.some((token) => normalizeToken(token).length >= 2);

  if (!hasMeaningfulToken) {
    logger.debug(`Patient name: "${name}" has no meaningful tokens, inferring "Unknown Patient"`);
    return { value: 'Unknown Patient', inferred: true, field: 'name' };
  }

  logger.debug(`Patient name: resolved to "${cleaned}"`);
  return { value: cleaned, inferred: false, field: 'name' };
}

/**
 * Resolve patient gender from extracted data
 * @param {string} gender - Patient gender
 * @returns {Object} Resolved gender with inference flag
 */
function resolvePatientGender(gender) {
  if (typeof gender !== 'string' || !gender.trim()) {
    logger.debug('Patient gender: missing, inferring "unknown"');
    return { value: 'unknown', inferred: true, field: 'gender' };
  }

  const normalized = normalizeGender(gender);

  logger.debug(`Patient gender: resolved to "${normalized}"`);
  return { value: normalized, inferred: false, field: 'gender' };
}

/**
 * Resolve patient birth date from extracted data
 * @param {string} birthDate - Patient birth date
 * @returns {Object} Resolved birth date with inference flag
 */
function resolvePatientBirthDate(birthDate) {
  if (!birthDate) {
    logger.debug('Patient birthDate: missing');
    return { value: undefined, inferred: false, field: 'birthDate' };
  }

  const fhirDate = toFhirDate(birthDate);
  if (fhirDate) {
    logger.debug(`Patient birthDate: resolved to "${fhirDate}"`);
    return { value: fhirDate, inferred: false, field: 'birthDate' };
  }

  logger.warn(`Patient birthDate: could not parse "${birthDate}"`);
  return { value: undefined, inferred: false, field: 'birthDate' };
}

/**
 * Resolve patient identifier from extracted data
 * @param {string} patientLocalId - Patient local ID
 * @param {Object} sourceDocument - Source document
 * @returns {Object} Resolved identifier with inference flag
 */
function resolvePatientIdentifier(patientLocalId, sourceDocument) {
  if (typeof patientLocalId === 'string' && patientLocalId.trim()) {
    const tokenized = patientLocalId
      .trim()
      .split(/\s+/)
      .find((token) => {
        const normalized = normalizeToken(token);
        return normalized && !INVALID_TOKENS.has(normalized);
      });
    if (tokenized) {
      logger.debug(`Patient identifier: resolved to "${tokenized}"`);
      return { value: tokenized, inferred: false, field: 'identifier' };
    }
  }

  const sha = String(sourceDocument?.sha256 || '').replace(/[^a-fA-F0-9]/g, '');
  const suffix = (sha.slice(0, 12) || 'unknown').toUpperCase();
  const inferredId = `AUTO-${suffix}`;
  logger.debug(`Patient identifier: inferred "${inferredId}" from source document`);
  return { value: inferredId, inferred: true, field: 'identifier' };
}

/**
 * Resolve patient address from extracted data
 * @param {Object} extracted - Extracted data
 * @returns {Object} Resolved address with inference flag
 */
function resolvePatientAddress(extracted) {
  const addressFields = [
    extracted.patientAddress,
    extracted.address,
    extracted.patientPincode,
    extracted.pincode,
  ].filter(Boolean);

  if (addressFields.length === 0) {
    logger.debug('Patient address: missing');
    return { address: undefined, inferred: true };
  }

  const addressText = addressFields.join(', ');
  logger.debug(`Patient address: resolved to "${addressText}"`);

  const pincodeMatch = addressText.match(/\b(\d{6})\b/);

  return {
    address: {
      text: addressText,
      ...(pincodeMatch ? { postalCode: pincodeMatch[1] } : {}),
    },
    inferred: false,
  };
}

/**
 * Build Patient FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @param {string} patientRef - Patient reference ID
 * @param {Object} sourceDocument - Source document
 * @returns {Object} Patient FHIR resource
 */
function buildPatientResource(extracted, patientRef, sourceDocument) {
  logger.info('Creating Patient resource');

  const patientIdentifier = resolvePatientIdentifier(extracted.patientLocalId, sourceDocument);
  const patientName = resolvePatientName(extracted.patientName);
  const patientGender = resolvePatientGender(extracted.patientGender);
  const patientBirthDate = resolvePatientBirthDate(extracted.patientDob || extracted.dateOfBirth);
  const patientAddress = resolvePatientAddress(extracted);

  const inferredFields = [];
  if (patientIdentifier.inferred) inferredFields.push('identifier');
  if (patientName.inferred) inferredFields.push('name');
  if (patientGender.inferred) inferredFields.push('gender');
  if (patientAddress.inferred) inferredFields.push('address');

  const patient = {
    resourceType: 'Patient',
    id: patientRef,
    identifier: [
      {
        system: `${EXAMPLE_HSP_SYSTEM}/patient-id`,
        value: patientIdentifier.value,
      },
    ],
    name: [
      {
        text: patientName.value,
      },
    ],
    gender: patientGender.value,
    ...(patientBirthDate.value ? { birthDate: patientBirthDate.value } : {}),
    ...(patientAddress.address ? { address: [patientAddress.address] } : {}),
  };

  if (inferredFields.length > 0) {
    patient.extension = [
      {
        url: `${EXAMPLE_HSP_SYSTEM}/fhir/StructureDefinition/inferred-demographics`,
        extension: inferredFields.map((field) => ({
          url: field,
          valueBoolean: true,
        })),
      },
    ];
    logger.debug(`Patient: added inference extension for fields: ${inferredFields.join(', ')}`);
  }

  logger.info('Patient resource created successfully');
  return patient;
}

export {
  buildPatientResource,
  resolvePatientName,
  resolvePatientGender,
  resolvePatientBirthDate,
  resolvePatientIdentifier,
  resolvePatientAddress,
};
