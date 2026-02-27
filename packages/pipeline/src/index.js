/**
 * Pipeline - Main orchestrator for the FHIR conversion pipeline
 * Coordinates classification, extraction, enrichment, mapping, and validation stages
 */

import { createLogger, ValidationError } from '@hc-fhir/shared';
import { getHospitalTemplate, getConfig } from '../../config/src/index.js';
import { detectHiType } from '../../doc-classifier/src/index.js';
import { extractStructuredData } from '../../clinical-extractor/src/index.js';
import { mapToClaimSubmissionBundle } from '../../fhir-mapper/src/index.js';
import { evaluateCompliance } from '../../compliance/src/index.js';
import { evaluateDocumentQuality } from '../../quality/src/index.js';
import { validateClaimBundle } from '../../fhir-validator/src/index.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Simple structured logger
const logger = {
  _format(level, event, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event: `[pipeline:${level}] ${event}`,
      ...meta,
    });
  },

  error(event, error, meta = {}) {
    console.error(this._format('error', event, {
      ...meta,
      message: error?.message,
      stack: error?.stack,
    }));
  },

  info(event, meta = {}) {
    console.log(this._format('info', event, meta));
  },

  warn(event, meta = {}) {
    console.warn(this._format('warn', event, meta));
  },
};

function logError(event, error, meta = {}) {
  logger.error(event, error, meta);
}

function logInfo(event, meta = {}) {
  logger.info(event, meta);
}

function logWarn(event, meta = {}) {
  logger.warn(event, meta);
}

// Input validation
function validateInput({ claimId, documents }) {
  const errors = [];

  if (typeof claimId !== 'string' || claimId.trim().length === 0) {
    errors.push('claimId must be a non-empty string');
  }

  if (!Array.isArray(documents) || documents.length === 0) {
    errors.push('documents must be a non-empty array');
  } else {
    documents.forEach((doc, index) => {
      if (!doc || typeof doc !== 'object') {
        errors.push(`documents[${index}] must be an object`);
      } else if (!doc.fileName || typeof doc.fileName !== 'string') {
        errors.push(`documents[${index}] must have a valid fileName`);
      }
    });
  }

  if (errors.length > 0) {
    const error = new Error(`Input validation failed: ${errors.join(', ')}`);
    error.code = 'INVALID_INPUT';
    error.validationErrors = errors;
    throw error;
  }
}

function shouldRunLlmEnrichment({ textLength, llmFallback, qualityStatus }) {
  if (qualityStatus === 'pass') {
    return false;
  }

  if (!llmFallback || typeof llmFallback.enhance !== 'function') {
    return false;
  }

  const config = getConfig();
  if (!textLength || textLength < config.llmEnrichmentMinTextLength) {
    return false;
  }

  return true;
}

function mergeExtractionDiagnostics(baseDiagnostics, llmEnrichmentDiagnostics) {
  if (!llmEnrichmentDiagnostics) {
    return baseDiagnostics;
  }
  if (baseDiagnostics && typeof baseDiagnostics === 'object' && !Array.isArray(baseDiagnostics)) {
    return {
      ...baseDiagnostics,
      llmEnrichment: llmEnrichmentDiagnostics,
      llmFallback: llmEnrichmentDiagnostics,
    };
  }
  return {
    llmEnrichment: llmEnrichmentDiagnostics,
    llmFallback: llmEnrichmentDiagnostics,
  };
}

function mergeLlmExtracted(baseExtracted, llmExtracted) {
  const scalarKeys = [
    'patientName',
    'patientLocalId',
    'admissionDate',
    'dischargeDate',
    'finalDiagnosis',
    'testName',
    'resultValue',
    'observationDate',
  ];
  const merged = {
    ...(baseExtracted || {}),
  };
  const candidate = llmExtracted && typeof llmExtracted === 'object'
    ? llmExtracted
    : {};

  for (const key of scalarKeys) {
    const value = candidate[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      merged[key] = value;
    }
  }

  const config = getConfig();
  const candidateObservations = Array.isArray(candidate.observations) ? candidate.observations : [];
  if (candidateObservations.length > 0) {
    merged.observations = candidateObservations.slice(0, config.maxObservationsPerReport);
  } else if (!Array.isArray(merged.observations)) {
    merged.observations = [];
  }

  return merged;
}

function resolveEnrichedHiType(currentHiType, candidateHiType) {
  if (typeof candidateHiType !== 'string' || candidateHiType.trim().length === 0) {
    return currentHiType;
  }
  const normalizedCandidate = candidateHiType.trim().toLowerCase();
  if (normalizedCandidate === 'unknown' && currentHiType !== 'unknown') {
    return currentHiType;
  }
  if (normalizedCandidate === 'diagnostic report') {
    return 'diagnostic_report';
  }
  if (normalizedCandidate === 'discharge summary') {
    return 'discharge_summary';
  }
  return candidateHiType;
}

async function mapWithConcurrency(items, concurrency, iterator) {
  const list = Array.isArray(items) ? items : [];
  const config = getConfig();
  const limit = Math.max(1, Number(concurrency) || config.documentConcurrency);
  const results = new Array(list.length);
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await iterator(list[index], index);
    }
  }

  const workers = [];
  const workerCount = Math.min(limit, list.length);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function resolveDocumentText(document, extractionEngine) {
  if (typeof document.text === 'string') {
    logInfo('document_text_provided', {
      fileName: document?.fileName || null,
      textLength: document.text.trim().length,
    });
    return {
      text: document.text,
      sourceMode: 'provided',
      extractionMetadata: null,
    };
  }
  if (!extractionEngine) {
    logInfo('document_text_missing_no_extraction_engine', {
      fileName: document?.fileName || null,
    });
    return {
      text: '',
      sourceMode: 'missing',
      extractionMetadata: {
        reason: 'extraction_engine_missing',
      },
    };
  }

  const extracted = await extractionEngine.extract(document);
  logInfo('document_text_extracted', {
    fileName: document?.fileName || null,
    mode: extracted?.mode || 'unknown',
    textLength: (extracted?.text || '').trim().length,
  });
  if (extracted?.mode === 'extraction_failed') {
    const reason = extracted?.metadata?.reason || 'extraction_failed';
    const error = new Error(`document_extraction_failed:${reason}`);
    error.code = 'DOCUMENT_EXTRACTION_FAILED';
    error.fileName = document?.fileName || null;
    error.reason = reason;
    error.metadata = extracted?.metadata || null;
    throw error;
  }
  return {
    text: extracted?.text || '',
    sourceMode: extracted?.mode || 'unknown',
    extractionMetadata: extracted?.metadata || null,
  };
}

async function resolveDocumentSha256({ claimId, document, resolvedText }) {
  if (typeof document.sha256 === 'string' && document.sha256.trim()) {
    return document.sha256.trim();
  }

  if (typeof document.text === 'string' && document.text.length > 0) {
    return createHash('sha256').update(document.text).digest('hex');
  }

  if (typeof document.filePath === 'string' && document.filePath.trim()) {
    try {
      const content = await readFile(document.filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      logError('read_file_for_sha256_failed', error, {
        filePath: document.filePath,
        claimId,
      });
    }
  }

  if (typeof document.base64Pdf === 'string' && document.base64Pdf.length > 0) {
    return createHash('sha256').update(document.base64Pdf).digest('hex');
  }

  if (typeof document.imageBase64 === 'string' && document.imageBase64.length > 0) {
    return createHash('sha256').update(document.imageBase64).digest('hex');
  }

  logWarn('sha256_fallback_used', {
    claimId,
    fileName: document.fileName || 'unknown',
    reason: 'no_content_available_for_hash',
  });
  const fallbackSeed = `${claimId}:${document.fileName || 'unknown'}:${resolvedText || ''}`;
  return createHash('sha256').update(fallbackSeed).digest('hex');
}

async function convertClaimDocuments({
  claimId,
  documents,
  hospitalId,
  extractionEngine,
  llmFallback,
}) {
  validateInput({ claimId, documents });

  const template = getHospitalTemplate();
  const config = getConfig();

  const resolvedHospitalId = hospitalId || 'default';

  logInfo('conversion_started', {
    claimId,
    hospitalId: resolvedHospitalId,
    documentsCount: Array.isArray(documents) ? documents.length : 0,
    templateId: template?.id || 'unknown',
  });

  const classifications = [];
  const bundles = [];
  const qualityReports = [];
  const extractionReports = [];
  const documentConcurrency = config.documentConcurrency;
  const auditLog = [
    {
      action: 'convert_started',
      actor: 'system',
      timestamp: new Date().toISOString(),
    },
  ];

  const processDocument = async (document) => {
    const documentAuditEvents = [];
    logInfo('document_processing_started', {
      fileName: document?.fileName || null,
    });
    const { text, sourceMode, extractionMetadata } = await resolveDocumentText(document, extractionEngine);
    const textLength = (text || '').trim().length;

    const sha256 = await resolveDocumentSha256({
      claimId,
      document,
      resolvedText: text,
    });

    const hiType = detectHiType(text);
    logInfo('document_classified', {
      fileName: document?.fileName || null,
      hiType,
    });

    const extracted = extractStructuredData(text);
    const quality = evaluateDocumentQuality(extracted, text);
    logInfo('document_quality_evaluated', {
      fileName: document?.fileName || null,
      status: quality.status,
    });

    let enrichedExtracted = extracted;
    let llmExtracted = null;
    let mergedDiagnostics = extractionMetadata;

    if (shouldRunLlmEnrichment({ textLength, llmFallback, qualityStatus: quality.status })) {
      try {
        const llmResult = await llmFallback.enhance(text);
        if (llmResult?.extracted) {
          enrichedExtracted = mergeLlmExtracted(extracted, llmResult.extracted);
          mergedDiagnostics = mergeExtractionDiagnostics(extractionMetadata, llmResult.diagnostics);
          llmExtracted = llmResult.extracted;
          logInfo('document_enriched', {
            fileName: document?.fileName || null,
          });
        }
      } catch (error) {
        logError('llm_enrichment_failed', error, {
          fileName: document?.fileName || null,
        });
      }
    }

    const resolvedHiType = resolveEnrichedHiType(hiType, llmExtracted?.hiType);

    const bundle = mapToClaimSubmissionBundle({
      claimId,
      hiType: resolvedHiType,
      extracted: enrichedExtracted,
      sourceDocument: {
        sha256,
        fileName: document.fileName,
        content: document.base64Pdf || undefined,
        contentType: document.contentType || 'application/pdf',
      },
    });

    const validationResult = validateClaimBundle(bundle);
    const complianceResult = evaluateCompliance(bundle, resolvedHiType);

    auditLog.push({
      action: 'document_converted',
      document: document?.fileName,
      timestamp: new Date().toISOString(),
    });

    return {
      bundle,
      hiType: resolvedHiType,
      sourceDocument: {
        sha256,
        fileName: document.fileName,
      },
      extraction: {
        textLength,
        sourceMode,
      },
      quality,
      enriched: !!llmExtracted,
      validation: validationResult,
      compliance: complianceResult,
      auditLog: documentAuditEvents,
    };
  };

  const results = await mapWithConcurrency(documents, documentConcurrency, processDocument);

  const successful = results.filter((r) => r.validation?.valid);
  const failed = results.filter((r) => !r.validation?.valid);

  logInfo('conversion_completed', {
    claimId,
    total: results.length,
    successful: successful.length,
    failed: failed.length,
  });

  return {
    bundles: results.map((r) => r.bundle),
    metadata: {
      claimId,
      hospitalId: resolvedHospitalId,
      templateId: template?.id,
      documentsCount: results.length,
      successfulCount: successful.length,
      failedCount: failed.length,
    },
    results,
    auditLog,
  };
}

export {
  convertClaimDocuments,
};
