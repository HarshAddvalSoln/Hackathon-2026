// FHIR Mapper - NHCX-Compliant FHIR Bundle Generation
// For ABDM ecosystem claim submission

import { createLogger, ValidationError } from '@hc-fhir/shared';
import { buildPatientResource } from './resources/PatientResource.js';
import { buildOrganizationResource } from './resources/OrganizationResource.js';
import { buildPractitionerResource } from './resources/PractitionerResource.js';
import { buildEncounterResource } from './resources/EncounterResource.js';
import { buildDischargeResources } from './resources/CompositionResource.js';
import { buildDiagnosticResources } from './resources/DiagnosticReportResource.js';
import { buildCoverageResource } from './resources/CoverageResource.js';
import { buildDocumentReference } from './resources/DocumentReferenceResource.js';

const logger = createLogger('fhir-mapper');

const NHCX_PROFILE_URL = 'https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle';
const EXAMPLE_HSP_SYSTEM = 'https://example-hsp.local';

/**
 * Map extracted clinical data to NHCX-compliant FHIR Claim Bundle
 * @param {Object} params - Parameters
 * @param {string} params.claimId - Claim identifier
 * @param {string} params.hiType - Health item type (discharge_summary, diagnostic_report)
 * @param {Object} params.extracted - Extracted clinical data
 * @param {Object} params.sourceDocument - Source document data
 * @returns {Object} FHIR Bundle
 * @throws {ValidationError} If required fields are missing or invalid
 */
function mapToClaimSubmissionBundle({
  claimId,
  hiType,
  extracted = {},
  sourceDocument = {},
}) {
  logger.info('=== Starting FHIR Bundle Generation ===', { claimId, hiType });
  logger.debug('Extracted data keys:', Object.keys(extracted));

  // Validate required inputs
  if (!claimId) {
    logger.error('Claim ID is required');
    throw new ValidationError('claimId is required', {
      field: 'claimId',
      validationErrors: [{ field: 'claimId', message: 'Claim ID is required' }],
    });
  }

  const validHiTypes = ['discharge_summary', 'diagnostic_report'];
  if (!hiType || !validHiTypes.includes(hiType)) {
    logger.error(`Invalid hiType: ${hiType}`);
    throw new ValidationError('hiType must be "discharge_summary" or "diagnostic_report"', {
      field: 'hiType',
      validationErrors: [{ field: 'hiType', message: `Invalid hiType: ${hiType}` }],
    });
  }

  // Ensure sourceDocument has required fields
  if (!sourceDocument.sha256) {
    logger.warn('sourceDocument.sha256 missing, using placeholder');
    sourceDocument = {
      ...sourceDocument,
      sha256: sourceDocument.sha256 || 'missing-sha256',
      fileName: sourceDocument.fileName || 'unknown.pdf',
    };
  }

  const patientRef = 'patient-1';
  const resources = [];

  // Create Patient resource
  const patient = buildPatientResource(extracted, patientRef, sourceDocument);
  resources.push(patient);

  // Create Organization (hospital/facility)
  const organization = buildOrganizationResource(extracted);
  if (organization) {
    resources.push(organization);
  }

  // Create Practitioner (attending physician)
  const practitioner = buildPractitionerResource(extracted);
  const practitionerRef = practitioner ? 'practitioner-1' : null;
  if (practitioner) {
    resources.push(practitioner);
  }

  // Create Encounter
  const encounter = buildEncounterResource(
    extracted,
    patientRef,
    practitionerRef,
    organization ? 'organization-1' : null
  );
  resources.push(encounter);

  // Create type-specific resources
  if (hiType === 'discharge_summary') {
    const dischargeResources = buildDischargeResources(extracted, patientRef, practitionerRef);
    resources.push(...dischargeResources);
  } else if (hiType === 'diagnostic_report') {
    const diagnosticResources = buildDiagnosticResources(extracted, patientRef);
    resources.push(...diagnosticResources);
  }

  // Create Coverage (insurance/payer)
  const coverage = buildCoverageResource(extracted);
  if (coverage) {
    resources.push(coverage);
  }

  // Create DocumentReference
  const docRef = buildDocumentReference(sourceDocument, patientRef, hiType);
  resources.push(docRef);

  // Create Bundle
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    identifier: {
      system: `${EXAMPLE_HSP_SYSTEM}/claim`,
      value: claimId,
    },
    meta: {
      profile: [NHCX_PROFILE_URL],
    },
    entry: resources.map((resource) => ({ resource })),
  };

  logger.info('=== FHIR Bundle Complete ===', {
    totalResources: resources.length,
    resourceTypes: resources.map((r) => r.resourceType).join(', '),
    profile: NHCX_PROFILE_URL,
  });

  return bundle;
}

export {
  mapToClaimSubmissionBundle,
};
