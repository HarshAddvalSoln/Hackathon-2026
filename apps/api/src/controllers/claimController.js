/**
 * Claim Controller
 * Handles claim conversion requests
 */

const { randomUUID } = require('node:crypto');
const { createLogger, ValidationError, ExtractionError } = require('@hc-fhir/shared');
const { convertClaimDocuments } = require('../../../../packages/pipeline/src/index');
const { createDefaultLlmFallback } = require('../../../../packages/llm-fallback/src/index');

const logger = createLogger('api:claim-controller');

/**
 * Handle convert claim documents request
 * @param {Object} params - Parameters
 * @param {Object} params.body - Request body
 * @param {Object} params.extractionEngine - Extraction engine
 * @param {Object} params.llmFallback - LLM fallback service
 * @returns {Promise<Object>} Response
 */
async function handleConvertClaim({ body, extractionEngine, llmFallback }) {
  const claimId =
    typeof body.claimId === 'string' && body.claimId.trim()
      ? body.claimId.trim()
      : `CLM-${randomUUID()}`;

  const documents = body.documents;
  const hospitalId = body.hospitalId;

  const jobId = randomUUID();
  const startTime = Date.now();

  logger.info('Processing claim conversion', {
    jobId,
    claimId,
    documentsCount: documents.length,
  });

  try {
    const output = await convertClaimDocuments({
      claimId,
      documents,
      hospitalId,
      extractionEngine,
      llmFallback,
    });

    logger.info('Claim conversion completed', {
      jobId,
      claimId,
      bundlesCount: output.bundles?.length || 0,
      durationMs: Date.now() - startTime,
    });

    return {
      statusCode: 200,
      body: {
        jobId,
        status: 'completed',
        output,
      },
    };
  } catch (error) {
    logger.error('Claim conversion failed', {
      jobId,
      claimId,
      error: error.message,
      code: error.code,
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ExtractionError || error.code === 'DOCUMENT_EXTRACTION_FAILED') {
      return {
        statusCode: 422,
        body: {
          error: 'document_extraction_failed',
          details: {
            fileName: error.fileName || null,
            reason: error.reason || error.message || 'document_extraction_failed',
            metadata: error.details?.metadata || null,
          },
        },
      };
    }

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: {
          error: 'validation_error',
          details: error.validationErrors || [],
        },
      };
    }

    return {
      statusCode: 500,
      body: {
        error: 'conversion_failed',
        message: error.message,
      },
    };
  }
}

/**
 * Get job status
 * @param {Object} params - Parameters
 * @param {string} params.jobId - Job ID
 * @param {Map} params.jobs - Jobs map
 * @returns {Object} Response
 */
function handleGetJobStatus({ jobId, jobs }) {
  const job = jobs.get(jobId);

  if (!job) {
    return {
      statusCode: 404,
      body: {
        error: 'job_not_found',
        jobId,
      },
    };
  }

  return {
    statusCode: 200,
    body: {
      jobId,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt || null,
      output: job.output || null,
    },
  };
}

/**
 * Create claim controller
 * @param {Object} options - Options
 * @param {Object} options.extractionService - Extraction service
 * @returns {Object} Claim controller
 */
function createClaimController(options = {}) {
  const { extractionService } = options;
  const jobs = new Map();
  const llmFallback = createDefaultLlmFallback();

  return {
    /**
     * Handle a request
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} Response
     */
    async handle({ method, url, body, files }) {
      const normalizedUrl = normalizeUrl(url);

      logger.debug('Handling request', { method, url: normalizedUrl });

      // POST /v1/claims/convert
      if (method === 'POST' && normalizedUrl === '/v1/claims/convert') {
        return handleConvertClaim({
          body,
          extractionEngine: extractionService?.getEngine(),
          llmFallback,
        });
      }

      // GET /v1/claims/convert/:jobId
      if (method === 'GET' && normalizedUrl.startsWith('/v1/claims/convert/')) {
        const jobId = normalizedUrl.split('/').pop();
        return handleGetJobStatus({ jobId, jobs });
      }

      // 404 for other routes
      return {
        statusCode: 404,
        body: { error: 'not_found', path: normalizedUrl },
      };
    },

    /**
     * Get jobs map (for testing)
     * @returns {Map} Jobs map
     */
    getJobs() {
      return jobs;
    },
  };
}

/**
 * Normalize URL path
 * @param {string} url - URL path
 * @returns {string} Normalized path
 */
function normalizeUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }
  if (url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
}

module.exports = {
  handleConvertClaim,
  handleGetJobStatus,
  createClaimController,
};
