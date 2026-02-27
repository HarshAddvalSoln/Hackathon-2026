/**
 * Body Parser Middleware
 * Parses request bodies
 */

const { createLogger } = require('@hc-fhir/shared');

const logger = createLogger('api:middleware');

/**
 * Read JSON body from request
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Parsed body
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        logger.error('Failed to parse JSON body', { error: error.message });
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Read raw body from request
 * @param {Object} req - Request object
 * @returns {Promise<Buffer>} Raw body buffer
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/**
 * Create body parser middleware
 * @param {Object} options - Options
 * @returns {Function} Middleware function
 */
function createBodyParser(options = {}) {
  const { maxBodySize = 10 * 1024 * 1024 } = options; // 10MB default

  return async function bodyParser(req, res) {
    // Only parse POST and PUT
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return;
    }

    const contentType = req.headers['content-type'] || '';
    const isJson = contentType.includes('application/json');

    try {
      if (isJson) {
        const body = await readJsonBody(req);
        req.body = body;
      } else {
        req.body = {};
      }
    } catch (error) {
      sendJson(res, 400, {
        error: 'invalid_request',
        message: 'Failed to parse request body',
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
  readJsonBody,
  readRawBody,
  createBodyParser,
  sendJson,
};
