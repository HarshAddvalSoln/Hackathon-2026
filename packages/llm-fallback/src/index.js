/**
 * LLM Fallback Service
 * Uses Ollama LLM to enrich incomplete clinical data extractions
 */

import { createLogger } from '@hc-fhir/shared';
import { createOllamaClient } from './services/ollamaClient.js';
import { parseOllamaContent, safeJsonParse, sanitizeFallbackPayload } from './parsers/responseParser.js';

const logger = createLogger('llm-fallback');

// Try to import enrichment prompt, fallback to inline if not available
let buildEnrichmentPrompt;
try {
  ({ buildEnrichmentPrompt } = await import('./prompts/enrichmentPrompt.js'));
} catch {
  // Fallback inline prompt builder
  buildEnrichmentPrompt = (text, hiType, sourceFileName) => {
    const typeInfo = hiType === 'diagnostic_report'
      ? 'Diagnostic Report (Lab Report)'
      : hiType === 'discharge_summary'
        ? 'Discharge Summary'
        : 'Unknown';
    const filenameHint = sourceFileName
      ? `\nFILENAME: "${sourceFileName}" - numbers in filename = Patient ID (e.g., "1002500515.pdf" → patientLocalId: "1002500515")`
      : '';

    return `You are a medical document parser for India's ABDM/NHCX healthcare system.

## TASK
Extract structured clinical data from this ${typeInfo} for FHIR claim submission.${filenameHint}

## INPUT
${text.slice(0, 8000)}

## RULES
- Extract ONLY visible data - do NOT hallucinate
- Use null for missing fields
- Dates: convert to YYYY-MM-DD
- Filename numbers = Patient ID

## FIELDS
patientName, patientLocalId, patientGender, patientDob, patientAddress
hospitalName, hospitalAddress, attendingPhysician, physicianRegNo
Diagnostic: testName, observationDate, observations=[{name,value,unit,referenceRange}]
Discharge: admissionDate, dischargeDate, chiefComplaint, finalDiagnosis, procedureDone
payerName, policyNumber, memberId

## OUTPUT
Return ONLY valid JSON:
{"hiType":"${hiType}","extracted":{"patientName":"JOHN","patientLocalId":"1002500515","testName":"CBC","observationDate":"2026-01-26","observations":[{"name":"Hemoglobin","value":"13.5","unit":"g/dL"}]}}`;
  };
}

const TRACE_PATH = process.env.LLM_FALLBACK_TRACE_PATH || '/tmp/llm-fallback-output.ndjson';

/**
 * Write trace entry to file
 * @param {Object} entry - Trace entry
 */
async function writeTrace(entry) {
  try {
    const { appendFile } = require('node:fs/promises');
    await appendFile(TRACE_PATH, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    logger.warn('Failed to write trace', { error: error.message });
  }
}

/**
 * Create an Ollama LLM fallback service
 * @param {Object} options - Options
 * @param {string} [options.baseUrl='http://127.0.0.1:11434'] - Ollama base URL
 * @param {string} [options.model='gemma3:4b'] - Model name
 * @param {Function} [options.fetchImpl=fetch] - Fetch implementation
 * @returns {Object} LLM fallback service
 */
function createOllamaLlmFallback({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'gemma3:4b',
  fetchImpl = fetch,
} = {}) {
  const client = createOllamaClient({ baseUrl, model, fetchImpl });

  /**
   * Enhance extracted data using LLM
   * @param {Object} params - Parameters
   * @param {string} params.text - Document text
   * @param {string} [params.hiType] - HI type hint
   * @param {string} [params.sourceFileName] - Source file name
   * @returns {Promise<Object|null>} Enhanced data or null
   */
  const enhance = async ({ text, hiType, sourceFileName = null }) => {
    const promptText = String(text || '').replace(/\r/g, '').trim();

    if (!promptText) {
      logger.debug('Skipped empty text');
      return null;
    }

    logger.info('Starting LLM enhancement', {
      hiType,
      textLength: promptText.length,
      model,
      sourceFileName,
    });

    try {
      const promptContent = buildEnrichmentPrompt(promptText, hiType, sourceFileName);

      console.log("[llm-fallback] Prompt being sent to LLM:");
      console.log(promptContent.substring(0, 1000) + "...");
      console.log("[llm-fallback] Model:", model);

      logger.debug('LLM prompt prepared', {
        promptLength: promptContent.length,
        model,
      });

      const payload = await client.chat({ prompt: promptContent });
      const rawContent = parseOllamaContent(payload);

      logger.debug('LLM response received', {
        rawContentLength: rawContent?.length || 0,
      });

      // Parse and validate JSON
      const parsed = safeJsonParse(rawContent);
      if (!parsed) {
        logger.warn('LLM response invalid JSON', {
          rawContentLength: rawContent?.length,
        });
        return null;
      }

      const sanitized = sanitizeFallbackPayload(parsed);

      // Write trace
      await writeTrace({
        timestamp: new Date().toISOString(),
        sourceFileName,
        model,
        hiTypeInput: hiType,
        promptLength: promptText.length,
        rawContent,
        sanitizedPayload: sanitized,
        status: sanitized ? 'parsed' : 'invalid_payload',
      });

      if (!sanitized) {
        logger.warn('LLM payload sanitization failed');
        return null;
      }

      return {
        hiType: sanitized.hiType,
        extracted: sanitized.extracted,
        diagnostics: { provider: 'ollama', model, status: 'parsed' },
      };
    } catch (error) {
      logger.error('LLM enhancement failed', {
        error: error.message,
      });
      return null;
    }
  };

  return { enhance, client };
}

/**
 * Create default LLM fallback with default settings
 * @returns {Object} LLM fallback service
 */
function createDefaultLlmFallback() {
  return createOllamaLlmFallback();
}

export {
  createOllamaLlmFallback,
  createDefaultLlmFallback,
  buildEnrichmentPrompt,
};
