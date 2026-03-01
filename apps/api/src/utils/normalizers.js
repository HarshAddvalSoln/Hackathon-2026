/**
 * Request Normalizers
 * Normalizes incoming request data
 */

const { readFile } = require('node:fs/promises');

/**
 * Normalize documents input from request
 * @param {Object} body - Request body
 * @param {Object[]} files - Uploaded files
 * @returns {Object} Normalized body
 */
async function normalizeDocumentsInput(body, files) {
  const mergedBody = { ...(body || {}) };

  // Parse documents if it's a JSON string
  if (typeof mergedBody.documents === 'string') {
    try {
      mergedBody.documents = JSON.parse(mergedBody.documents);
    } catch {
      // Invalid - will be caught by validation
    }
  }

  // Convert uploaded files to document format with base64 content
  const fileDocuments = await Promise.all((files || []).map(async (file) => {
    const doc = {
      fileName: file.originalFilename || file.filename || 'unknown.pdf',
    };

    // Read file content if filePath exists
    if (file.filePath) {
      try {
        const fileContent = await readFile(file.filePath);
        doc.base64Pdf = fileContent.toString('base64');
        doc.contentType = 'application/pdf';
      } catch (err) {
        console.error('Failed to read file:', err.message);
      }
    }

    return doc;
  }));

  // Ensure documents is an array
  if (!Array.isArray(mergedBody.documents)) {
    mergedBody.documents = [];
  }

  // Merge file documents
  if (fileDocuments.length > 0) {
    mergedBody.documents = [...mergedBody.documents, ...fileDocuments];
  }

  return mergedBody;
}

/**
 * Normalize claim ID
 * @param {string} claimId - Claim ID
 * @returns {string} Normalized claim ID
 */
function normalizeClaimId(claimId) {
  if (!claimId || typeof claimId !== 'string') {
    return null;
  }
  return claimId.trim();
}

module.exports = {
  normalizeDocumentsInput,
  normalizeClaimId,
};
