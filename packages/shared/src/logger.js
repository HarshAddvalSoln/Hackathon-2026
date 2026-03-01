/**
 * Centralized structured logger for the FHIR conversion system.
 * Provides consistent JSON logging with correlation IDs across all packages.
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Creates a logger instance for a specific module
 * @param {string} moduleName - The name of the module (e.g., 'fhir-mapper', 'pipeline')
 * @returns {Object} Logger instance
 */
function createLogger(moduleName) {
  const currentLevel = process.env.LOG_LEVEL
    ? LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] ?? LOG_LEVELS.info
    : LOG_LEVELS.info;

  const formatMessage = (level, message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: moduleName,
      message,
      ...meta,
    };

    if (process.env.CORRELATION_ID) {
      logEntry.correlationId = process.env.CORRELATION_ID;
    }

    return JSON.stringify(logEntry);
  };

  const shouldLog = (level) => LOG_LEVELS[level] <= currentLevel;

  return {
    error: (message, meta = {}) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message, meta));
      }
    },

    warn: (message, meta = {}) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message, meta));
      }
    },

    info: (message, meta = {}) => {
      if (shouldLog('info')) {
        console.log(formatMessage('info', message, meta));
      }
    },

    debug: (message, meta = {}) => {
      if (shouldLog('debug')) {
        console.log(formatMessage('debug', message, meta));
      }
    },

    child: (context) => {
      return {
        error: (message, meta = {}) => {
          if (shouldLog('error')) {
            console.error(formatMessage('error', message, { ...meta, context }));
          }
        },
        warn: (message, meta = {}) => {
          if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message, { ...meta, context }));
          }
        },
        info: (message, meta = {}) => {
          if (shouldLog('info')) {
            console.log(formatMessage('info', message, { ...meta, context }));
          }
        },
        debug: (message, meta = {}) => {
          if (shouldLog('debug')) {
            console.log(formatMessage('debug', message, { ...meta, context }));
          }
        },
      };
    },
  };
}

/**
 * Middleware to add correlation ID to requests
 */
function correlationIdMiddleware(req, res, next) {
  const id = req.headers['x-correlation-id'] || req.headers['correlation-id'] || generateCorrelationId();
  req.correlationId = id;
  res.setHeader('X-Correlation-Id', id);
  process.env.CORRELATION_ID = id;
  next();
}

/**
 * Generate a unique correlation ID
 */
function generateCorrelationId() {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export {
  createLogger,
  correlationIdMiddleware,
  generateCorrelationId,
  LOG_LEVELS,
};
