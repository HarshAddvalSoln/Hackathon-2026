/**
 * Organization FHIR Resource Builder
 * Creates NHCX-compliant Organization resources
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('fhir-mapper:Organization');

const EXAMPLE_HSP_SYSTEM = 'https://example-hsp.local';

/**
 * Build Organization FHIR resource
 * @param {Object} extracted - Extracted clinical data
 * @returns {Object|null} Organization FHIR resource or null if no data
 */
function buildOrganizationResource(extracted) {
  logger.info('Creating Organization resource');

  const orgName = extracted.hospitalName || extracted.facilityName || extracted.organizationName;

  if (!orgName) {
    logger.debug('Organization: no data available, skipping');
    return null;
  }

  const organization = {
    resourceType: 'Organization',
    id: 'organization-1',
    identifier: [
      {
        system: `${EXAMPLE_HSP_SYSTEM}/organization-id`,
        value: extracted.hospitalId || extracted.facilityId || 'AUTO-ORG-001',
      },
    ],
    name: orgName,
  };

  if (extracted.hospitalAddress) {
    organization.address = [{ text: extracted.hospitalAddress }];
  }

  logger.debug(`Organization created: ${orgName}`);
  return organization;
}

export {
  buildOrganizationResource,
};
