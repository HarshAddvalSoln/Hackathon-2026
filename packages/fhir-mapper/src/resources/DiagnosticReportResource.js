/**
 * DiagnosticReport FHIR Resource Builder
 * Creates NHCX-compliant DiagnosticReport resources
 */

import { createLogger, dateUtils } from '@hc-fhir/shared';
const { toFhirDate } = dateUtils;

const logger = createLogger('fhir-mapper:DiagnosticReport');
import { buildObservationResource, toObservationInputs } from './ObservationResource.js';

/**
 * Build DiagnosticReport FHIR resource with associated observations
 * @param {Object} extracted - Extracted clinical data
 * @param {string} patientRef - Patient reference
 * @returns {Object[]} Array containing DiagnosticReport and Observation resources
 */
function buildDiagnosticResources(extracted, patientRef) {
  logger.info('Creating Diagnostic Report resources');

  const observationsInput = toObservationInputs(extracted);
  const observationResources = observationsInput.map((observation, index) =>
    buildObservationResource({
      observation,
      index,
      patientRef,
      observationDate: extracted.observationDate || extracted.testDate,
    })
  );

  const diagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: 'diagnostic-report-1',
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '11502-2',
          display: 'Laboratory report',
        },
      ],
      text: extracted.testName || 'Diagnostic Report',
    },
    subject: { reference: `Patient/${patientRef}` },
    effectiveDateTime: toFhirDate(extracted.observationDate || extracted.testDate),
    issued: toFhirDate(extracted.observationDate || extracted.testDate) || new Date().toISOString(),
    result: observationResources.map((item) => ({ reference: `Observation/${item.id}` })),
  };

  if (extracted.resultValue) {
    diagnosticReport.conclusion = extracted.resultValue;
  }

  if (extracted.interpretation || extracted.resultInterpretation) {
    diagnosticReport.interpretation = [
      {
        text: extracted.interpretation || extracted.resultInterpretation,
      },
    ];
  }

  logger.info(`DiagnosticReport created: ${diagnosticReport.id}, ${observationResources.length} observations`);
  return [diagnosticReport, ...observationResources];
}

export {
  buildDiagnosticResources,
};
