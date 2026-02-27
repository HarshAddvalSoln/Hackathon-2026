/**
 * Composition FHIR Resource Builder
 * Creates NHCX-compliant Composition resources for discharge summaries
 */

import { createLogger, dateUtils } from '@hc-fhir/shared';
const { toFhirDate } = dateUtils;

const logger = createLogger('fhir-mapper:Composition');

/**
 * Build Discharge Summary Composition FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @param {string} patientRef - Patient reference
 * @param {string} practitionerRef - Practitioner reference
 * @returns {Object[]} Array containing Condition and Composition resources
 */
function buildDischargeResources(extracted, patientRef, practitionerRef) {
  logger.info('Creating Discharge Summary resources');

  const admissionDate = toFhirDate(extracted.admissionDate);
  const dischargeDate = toFhirDate(extracted.dischargeDate);

  const condition = {
    resourceType: 'Condition',
    id: 'condition-1',
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
        },
      ],
    },
    subject: { reference: `Patient/${patientRef}` },
    code: { text: extracted.finalDiagnosis || 'Unknown diagnosis' },
  };

  const composition = {
    resourceType: 'Composition',
    id: 'composition-1',
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '34117-2',
          display: 'Discharge summary',
        },
      ],
      text: 'Discharge Summary',
    },
    subject: { reference: `Patient/${patientRef}` },
    date: dischargeDate || admissionDate || new Date().toISOString(),
    title: 'Discharge Summary',
    author: [],
  };

  if (practitionerRef) {
    composition.author.push({ reference: `Practitioner/${practitionerRef}` });
  }

  composition.section = [
    {
      title: 'Final Diagnosis',
      text: {
        status: 'generated',
        div: `<div>${extracted.finalDiagnosis || 'Unknown diagnosis'}</div>`,
      },
      entry: [{ reference: 'Condition/condition-1' }],
    },
  ];

  if (extracted.procedureDone) {
    composition.section.push({
      title: 'Procedures Done',
      text: {
        status: 'generated',
        div: `<div>${extracted.procedureDone}</div>`,
      },
    });
  }

  if (extracted.medications) {
    composition.section.push({
      title: 'Medications',
      text: {
        status: 'generated',
        div: `<div>${extracted.medications}</div>`,
      },
    });
  }

  logger.debug(`Created Condition: ${condition.id}, Composition: ${composition.id}`);
  return [condition, composition];
}

export {
  buildDischargeResources,
};
