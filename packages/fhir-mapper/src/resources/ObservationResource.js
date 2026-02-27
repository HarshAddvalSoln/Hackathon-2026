/**
 * Observation FHIR Resource Builder
 * Creates NHCX-compliant Observation resources for lab results and vital signs
 */

import { createLogger, dateUtils } from '@hc-fhir/shared';
const { toFhirDate } = dateUtils;

const logger = createLogger('fhir-mapper:Observation');

/**
 * Build a single Observation FHIR resource
 * @param {Object} params - Parameters
 * @param {Object} params.observation - Observation data
 * @param {number} params.index - Observation index
 * @param {string} params.patientRef - Patient reference
 * @param {string} params.observationDate - Observation date
 * @returns {Object} Observation FHIR resource
 */
function buildObservationResource({ observation, index, patientRef, observationDate }) {
  logger.debug(`Creating Observation ${index + 1}: ${observation.name}`);

  const normalizedDate = toFhirDate(observationDate);
  const parsedValue = Number.parseFloat(String(observation.value).replace(',', '.'));
  const hasQuantity = Number.isFinite(parsedValue) && observation.unit;

  const obs = {
    resourceType: 'Observation',
    id: `observation-${index + 1}`,
    status: 'final',
    subject: { reference: `Patient/${patientRef}` },
    code: { text: observation.name || 'Unknown test' },
    effectiveDateTime: normalizedDate,
  };

  if (hasQuantity) {
    obs.valueQuantity = {
      value: parsedValue,
      unit: observation.unit,
      system: 'http://unitsofmeasure.org',
      code: observation.unit,
    };
    logger.debug(`Observation ${obs.id}: value=${parsedValue} ${observation.unit}`);
  } else {
    obs.valueString = `${observation.value || ''} ${observation.unit || ''}`.trim() || 'Unknown result';
    logger.debug(`Observation ${obs.id}: non-numeric value`);
  }

  if (observation.referenceRangeLow || observation.referenceRangeHigh) {
    obs.referenceRange = [
      {
        ...(observation.referenceRangeLow
          ? { low: { value: observation.referenceRangeLow, unit: observation.unit } }
          : {}),
        ...(observation.referenceRangeHigh
          ? { high: { value: observation.referenceRangeHigh, unit: observation.unit } }
          : {}),
      },
    ];
  }

  return obs;
}

/**
 * Convert extracted observations to observation inputs
 * @param {Object} extracted - Extracted clinical data
 * @param {number} maxObservations - Maximum observations to include
 * @returns {Object[]} Observation inputs
 */
function toObservationInputs(extracted, maxObservations = 50) {
  if (Array.isArray(extracted.observations) && extracted.observations.length > 0) {
    const observations = extracted.observations.slice(0, maxObservations);
    logger.debug(`Observations: using ${observations.length} from extracted.observations array`);
    return observations;
  }

  // Fallback to single observation from individual fields
  if (extracted.testName || extracted.resultValue) {
    logger.debug('Observations: using fallback single observation from testName/resultValue');
    return [
      {
        name: extracted.testName,
        value: extracted.resultValue,
        unit: extracted.resultUnit || '',
      },
    ];
  }

  logger.debug('Observations: no data available, returning empty array');
  return [];
}

export {
  buildObservationResource,
  toObservationInputs,
};
