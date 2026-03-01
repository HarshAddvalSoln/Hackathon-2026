/**
 * Shared type definitions (JSDoc)
 * @typedef {Object} Document
 * @property {string} fileName - Name of the document file
 * @property {string} [content] - Text content of the document
 * @property {string} [base64] - Base64 encoded document content
 * @property {string} [mimeType] - MIME type of the document
 * @property {number} [pageCount] - Number of pages in the document

 * @typedef {Object} ClaimData
 * @property {Document[]} documents - Array of documents
 * @property {string} [claimId] - Claim identifier
 * @property {string} [policyId] - Policy identifier
 * @property {string} [insurerId] - Insurer identifier

 * @typedef {Object} ExtractedData
 * @property {Object} patient - Extracted patient information
 * @property {Object} encounter - Extracted encounter information
 * @property {Object[]} diagnoses - Extracted diagnoses
 * @property {Object[]} procedures - Extracted procedures
 * @property {Object[]} observations - Extracted observations
 * @property {Object[]} medications - Extracted medications
 * @property {Object} claim - Extracted claim information

 * @typedef {Object} FHIRBundle
 * @property {string} resourceType - Always "Bundle"
 * @property {string} type - Bundle type (always "collection")
 * @property {Object[]} entry - Array of FHIR resources

 * @typedef {Object} PipelineOptions
 * @property {boolean} [enableEnrichment] - Enable LLM enrichment
 * @property {boolean} [enableValidation] - Enable FHIR validation
 * @property {boolean} [enableCompliance] - Enable compliance checks
 * @property {string} [strategy] - Extraction strategy (digital-first, ocr-first, scan-only)
 * @property {number} [concurrency] - Number of concurrent documents to process

 * @typedef {Object} PipelineResult
 * @property {FHIRBundle} bundle - FHIR bundle
 * @property {Object} metadata - Pipeline metadata
 * @property {string[]} warnings - Warnings during processing
 * @property {Object[]} errors - Errors during processing
 */

export {};
