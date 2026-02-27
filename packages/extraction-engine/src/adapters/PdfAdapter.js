/**
 * PDF Adapter Interface
 * Defines the contract for PDF text extraction adapters
 */

import { ensureAdapter } from './index.js';

/**
 * Create a PDF extraction adapter
 * @param {Object} options - Adapter options
 * @param {Function} options.pdfLibrary - PDF library (e.g., pdfjs-dist)
 * @param {Function} options.getDocument - Function to get document from source
 * @returns {Object} PDF extraction adapter
 */
function createPdfAdapter({ pdfLibrary, getDocument }) {
  const adapter = {
    /**
     * Extract text from a PDF document
     * @param {Object} document - Document to extract from
     * @returns {Promise<Object>} Extraction result
     */
    async extract(document) {
      let pdfDoc;
      let source;

      if (document.filePath) {
        source = document.filePath;
      } else if (document.base64Pdf) {
        const pdfBuffer = Buffer.from(document.base64Pdf, 'base64');
        source = { data: pdfBuffer };
      } else {
        return {
          text: '',
          mode: 'digital_no_source',
          metadata: { reason: 'No PDF source provided' },
        };
      }

      try {
        pdfDoc = await getDocument(source);
        const numPages = pdfDoc.numPages;
        const textParts = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => item.str)
            .join(' ');
          textParts.push(pageText);
        }

        const fullText = textParts.join('\n\n');

        return {
          text: fullText,
          mode: 'digital_pdfjs',
          metadata: {
            pageCount: numPages,
            diagnostics: { errors: [] },
          },
        };
      } catch (error) {
        return {
          text: '',
          mode: 'digital_error',
          metadata: {
            reason: error.message,
            diagnostics: { errors: [{ stage: 'pdf_parsing', message: error.message }] },
          },
        };
      }
    },
  };

  return adapter;
}

/**
 * Validate PDF adapter
 * @param {Object} adapter - Adapter to validate
 */
function validatePdfAdapter(adapter) {
  ensureAdapter(adapter, 'PdfAdapter');
}

export {
  createPdfAdapter,
  validatePdfAdapter,
};
