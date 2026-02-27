/**
 * Shared utilities and constants for FHIR conversion system
 */

// Logger
import { createLogger, correlationIdMiddleware, generateCorrelationId, LOG_LEVELS } from './src/logger.js';

// Utils
import * as dateUtils from './src/utils/dateUtils.js';
import * as normalizationUtils from './src/utils/normalizationUtils.js';
import * as validationUtils from './src/utils/validationUtils.js';

// Errors
import { ExtractionError, ValidationError, EnrichmentError } from './src/errors/index.js';

// Constants
import { FHIR, getProfileForDocumentType } from './src/constants/fhirConstants.js';

export {
  // Logger
  createLogger,
  correlationIdMiddleware,
  generateCorrelationId,
  LOG_LEVELS,

  // Utils
  dateUtils,
  normalizationUtils,
  validationUtils,

  // Errors
  ExtractionError,
  ValidationError,
  EnrichmentError,

  // Constants
  FHIR,
  getProfileForDocumentType,
};
