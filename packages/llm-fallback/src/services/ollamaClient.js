/**
 * Ollama Client Service
 * HTTP client for communicating with Ollama LLM server
 */

import { createLogger } from '@hc-fhir/shared';

const logger = createLogger('llm-fallback:ollama-client');

const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes timeout

/**
 * Create an Ollama HTTP client
 * @param {Object} options - Options
 * @param {string} [options.baseUrl='http://127.0.0.1:11434'] - Ollama base URL
 * @param {string} [options.model='gemma3:4b'] - Model name
 * @param {Function} [options.fetchImpl=fetch] - Fetch implementation
 * @returns {Object} Ollama client
 */
function createOllamaClient({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'gemma3:4b',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  /**
   * Send a chat request to Ollama
   * @param {Object} params - Parameters
   * @param {string} params.prompt - Prompt text
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Ollama response
   */
  async function chat({ prompt, options = {} }) {
    const requestBody = {
      model,
      stream: false,
      format: 'json',
      options: {
        temperature: 0,
        num_predict: 1024, // Reduced for faster response
        top_p: 0.9,
        ...options,
      },
      messages: [{ role: 'user', content: prompt }],
    };

    logger.debug('Sending chat request to Ollama', {
      model,
      promptLength: prompt.length,
      timeoutMs,
    });

    // Create abort controller for timeout
    const controller = typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

    try {
      const response = await fetchImpl(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
      }

      const payload = await response.json();
      logger.debug('Ollama response received', {
        model,
        responseLength: JSON.stringify(payload).length,
      });

      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.error('Ollama request timed out', { model, timeoutMs });
        throw new Error(`LLM request timed out after ${timeoutMs}ms`);
      }
      logger.error('Ollama chat request failed', {
        error: error.message,
        model,
      });
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Check if Ollama server is available
   * @returns {Promise<boolean>} True if available
   */
  async function isAvailable() {
    try {
      const response = await fetchImpl(`${baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available models
   * @returns {Promise<string[]>} Array of model names
   */
  async function listModels() {
    try {
      const response = await fetchImpl(`${baseUrl}/api/tags`, {
        method: 'GET',
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }

  return {
    chat,
    isAvailable,
    listModels,
    baseUrl,
    model,
  };
}

export {
  createOllamaClient,
};
