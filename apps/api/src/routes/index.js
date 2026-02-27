/**
 * Routes
 * Defines API route handlers
 */

const { createLogger } = require('@hc-fhir/shared');
const { validateConvertRequest } = require('../utils/validators');
const { readJsonBody } = require('../middleware/bodyParser');
const { normalizeDocumentsInput } = require('./normalizers');

const logger = createLogger('api:routes');

/**
 * Normalize URL path
 * @param {string} url - URL path
 * @returns {string} Normalized path
 */
function normalizePath(url) {
  if (typeof url !== 'string') {
    return '';
  }
  if (url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
}

/**
 * Create route handler
 * @param {Object} options - Options
 * @param {Object} options.controller - Request controller
 * @returns {Function} Route handler
 */
function createRouteHandler(options = {}) {
  const { controller } = options;

  return async function handleRequest(req, res) {
    const normalizedUrl = normalizePath(req.url || req.path);

    logger.info('Request received', {
      method: req.method,
      url: normalizedUrl,
    });

    // Parse body for POST/PUT
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, {
          error: 'invalid_request',
          message: 'Failed to parse request body',
        });
        return;
      }
    }

    // Normalize documents input (merge files if any)
    const files = req.files || [];
    if (files.length > 0 || body.documents) {
      body = normalizeDocumentsInput(body, files);
    }

    // Handle request through controller
    try {
      const response = await controller.handle({
        method: req.method,
        url: normalizedUrl,
        body,
        files,
      });

      sendJson(res, response.statusCode, response.body);
    } catch (error) {
      logger.error('Request handling failed', {
        error: error.message,
        method: req.method,
        url: normalizedUrl,
      });

      sendJson(res, 500, {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      });
    }
  };
}

/**
 * Send JSON response
 * @param {Object} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} payload - Response body
 */
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

module.exports = {
  normalizePath,
  createRouteHandler,
  sendJson,
};
