/**
 * Encounter FHIR Resource Builder
 * Creates NHCX-compliant Encounter resources
 */

import { createLogger, dateUtils } from '@hc-fhir/shared';
const { toFhirDate } = dateUtils;

const logger = createLogger('fhir-mapper:Encounter');

const CODING_SYSTEMS = {
  ENCOUNTER_CLASS: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
};

/**
 * Build Encounter FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @param {string} patientRef - Patient reference
 * @param {string} practitionerRef - Practitioner reference
 * @param {string} organizationRef - Organization reference
 * @returns {Object} Encounter FHIR resource
 */
function buildEncounterResource(extracted, patientRef, practitionerRef, organizationRef) {
  logger.info('Creating Encounter resource');

  const admissionDate = toFhirDate(extracted.admissionDate);
  const dischargeDate = toFhirDate(extracted.dischargeDate);

  if (!admissionDate) {
    logger.warn('Encounter: admissionDate missing, using current date');
  }

  const encounter = {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'finished',
    class: {
      system: CODING_SYSTEMS.ENCOUNTER_CLASS,
      code: extracted.encounterType === 'emergency' ? 'EMER' : 'IMP',
      display: extracted.encounterType === 'emergency' ? 'emergency' : 'inpatient',
    },
    subject: { reference: `Patient/${patientRef}` },
    period: {
      start: admissionDate || new Date().toISOString().split('T')[0],
      end: dischargeDate || admissionDate,
    },
  };

  if (extracted.admissionReason || extracted.finalDiagnosis) {
    encounter.reasonCode = [
      {
        text: extracted.admissionReason || extracted.finalDiagnosis,
      },
    ];
  }

  if (organizationRef) {
    encounter.serviceProvider = { reference: `Organization/${organizationRef}` };
  }

  if (practitionerRef) {
    encounter.participant = [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'ATND',
              },
            ],
          },
        ],
        individual: { reference: `Practitioner/${practitionerRef}` },
      },
    ];
  }

  logger.info(`Encounter created: ${encounter.id}, class: ${encounter.class.code}`);
  return encounter;
}

export {
  buildEncounterResource,
};
