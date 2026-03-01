/**
 * OCR Prompt Builder for Medical Document Extraction
 * Specialized prompt for extracting text from healthcare documents for NHCX/FHIR claim submission
 */

export function buildOcrPrompt(imageCount = 1) {
  const pageInstruction = imageCount > 1 ? "Extract all visible text. Insert '---PAGE BREAK---' between pages." : "Extract all visible text.";

  return `You are a medical document OCR engine for NHCX claim processing in India.

## TASK
Extract ALL visible text. ${pageInstruction}

## EXTRACT
- Patient IDs: UHID, Patient ID, Hospital Number, Lab ID
- Dates: Admission, Discharge, Investigation, Sample Collection, DOB
- Clinical: diagnoses, complaints, procedures, surgeries, medications, dosages
- Lab: test names, codes, results, units, reference ranges
- Hospital/Lab: name, address, contact
- Insurance: company, policy number, member ID, claim ID
- All header/footer, watermarks, stamps

## OUTPUT
- Return exact text - do NOT summarize
- Preserve all medical terminology, abbreviations
- Extract EVERYTHING visible

Now extract:
`.trim();
}
