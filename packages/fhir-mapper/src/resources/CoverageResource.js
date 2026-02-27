/**
 * Coverage FHIR Resource Builder
 * Creates NHCX-compliant Coverage resources for insurance/payer information
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('fhir-mapper:Coverage');

const EXAMPLE_HSP_SYSTEM = 'https://example-hsp.local';

/**
 * Build Coverage FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @returns {Object|null} Coverage FHIR resource or null if no data
 */
function buildCoverageResource(extracted) {
  logger.info('Creating Coverage resource');

  const payerName = extracted.payerName || extracted.insuranceCompany || extracted.insuranceProvider;
  const policyNumber = extracted.policyNumber || extracted.policyNo;
  const memberId = extracted.memberId || extracted.patientPolicyId;

  if (!payerName && !policyNumber) {
    logger.debug('Coverage: no data available, skipping');
    return null;
  }

  const coverage = {
    resourceType: 'Coverage',
    id: 'coverage-1',
    status: extracted.coverageStatus === 'active' ? 'active' : 'cancelled',
    beneficiary: { reference: 'Patient/patient-1' },
    payor: [{ text: payerName || 'Unknown Payer' }],
  };

  if (policyNumber) {
    coverage.identifier = [
      {
        system: `${EXAMPLE_HSP_SYSTEM}/policy-number`,
        value: policyNumber,
      },
    ];
  }

  if (memberId) {
    coverage.subscriberId = memberId;
  }

  logger.debug(`Coverage created: ${payerName || policyNumber}`);
  return coverage;
}

export {
  buildCoverageResource,
};
