/**
 * DocumentReference FHIR Resource Builder
 * Creates NHCX-compliant DocumentReference resources
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('fhir-mapper:DocumentReference');

/**
 * Build DocumentReference FHIR resource
 * @param {Object} sourceDocument - Source document data
 * @param {string} patientRef - Patient reference
 * @param {string} hiType - Health item type (discharge_summary, diagnostic_report)
 * @returns {Object} DocumentReference FHIR resource
 */
function buildDocumentReference(sourceDocument, patientRef, hiType) {
  logger.info('Creating DocumentReference');

  if (!sourceDocument || !sourceDocument.sha256) {
    logger.warn('DocumentReference: sourceDocument incomplete, using placeholder');
  }

  const docRef = {
    resourceType: 'DocumentReference',
    id: 'source-doc-1',
    status: 'current',
    type: {
      coding:
        hiType === 'diagnostic_report'
          ? [{ system: 'http://loinc.org', code: '11502-2', display: 'Laboratory report' }]
          : [{ system: 'http://loinc.org', code: '34117-2', display: 'Discharge summary' }],
      text: hiType === 'diagnostic_report' ? 'Diagnostic Report' : 'Discharge Summary',
    },
    subject: { reference: `Patient/${patientRef}` },
    identifier: [
      {
        system: 'urn:sha256',
        value: sourceDocument?.sha256 || 'unknown',
      },
    ],
    description: sourceDocument?.fileName || 'Unknown document',
  };

  if (sourceDocument?.content) {
    docRef.content = [
      {
        attachment: {
          contentType: sourceDocument.contentType || 'application/pdf',
          data: sourceDocument.content,
        },
      },
    ];
  }

  logger.debug(`DocumentReference created: ${docRef.id}, type: ${hiType}`);
  return docRef;
}

export {
  buildDocumentReference,
};
