/**
 * Request Normalizers
 * Normalizes incoming request data
 */

/**
 * Normalize documents input from request
 * @param {Object} body - Request body
 * @param {Object[]} files - Uploaded files
 * @returns {Object} Normalized body
 */
function normalizeDocumentsInput(body, files) {
  const mergedBody = { ...(body || {}) };

  // Parse documents if it's a JSON string
  if (typeof mergedBody.documents === 'string') {
    try {
      mergedBody.documents = JSON.parse(mergedBody.documents);
    } catch {
      // Invalid - will be caught by validation
    }
  }

  // Convert uploaded files to document format
  const fileDocuments = (files || []).map((file) => ({
    fileName: file.fileName,
    filePath: file.filePath,
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
