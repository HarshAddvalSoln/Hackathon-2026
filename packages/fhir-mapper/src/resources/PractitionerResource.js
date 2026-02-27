/**
 * Practitioner FHIR Resource Builder
 * Creates NHCX-compliant Practitioner resources
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('fhir-mapper:Practitioner');

const EXAMPLE_HSP_SYSTEM = 'https://example-hsp.local';

/**
 * Build Practitioner FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @returns {Object|null} Practitioner FHIR resource or null if no data
 */
function buildPractitionerResource(extracted) {
  logger.info('Creating Practitioner resource');

  const practitionerName = extracted.attendingPhysician || extracted.physicianName || extracted.doctorName;
  const practitionerId = extracted.physicianRegNo || extracted.registrationNumber;

  if (!practitionerName && !practitionerId) {
    logger.debug('Practitioner: no data available, skipping');
    return null;
  }

  const practitioner = {
    resourceType: 'Practitioner',
    id: 'practitioner-1',
    identifier: [],
    name: [],
  };

  if (practitionerId) {
    practitioner.identifier.push({
      system: `${EXAMPLE_HSP_SYSTEM}/practitioner-reg-no`,
      value: practitionerId,
    });
  }

  if (practitionerName) {
    practitioner.name.push({
      text: practitionerName,
    });
  }

  logger.debug(`Practitioner created: ${practitionerName || practitionerId}`);
  return practitioner;
}

export {
  buildPractitionerResource,
};
