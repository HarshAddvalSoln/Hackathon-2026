/**
 * LLM Enrichment Prompt Builder
 * Extracts structured data from clinical documents for NHCX/FHIR claim submission
 */

function buildEnrichmentPrompt(text, hiType, sourceFileName) {
  const hiTypeDisplay = hiType === "diagnostic_report" ? "Diagnostic Report (Lab Report)" : hiType === "discharge_summary" ? "Discharge Summary" : "Unknown";

  // Extract potential patient ID from filename (common pattern: numbers in filename like "1002500515.pdf")
  const filenameHint = sourceFileName ? `
## FILENAME HINT
The filename is "${sourceFileName}". This often contains the Patient ID or Lab ID. Extract numbers from filename as patientLocalId.` : '';

  return `You are a medical document parser for India's ABDM/NHCX healthcare system.

## TASK
Extract structured clinical data from this ${hiTypeDisplay} for FHIR claim submission.${filenameHint}

## INPUT DOCUMENT OCR TEXT
${text}

## CRITICAL RULES
1. Extract ONLY data that is VISIBLE in the text - do NOT hallucinate
2. Use null for missing fields - never use empty strings
3. Dates: convert to YYYY-MM-DD format (e.g., 26-01-2026 → 2026-01-26)
4. Numbers in filename = Patient ID (e.g., "1002500515.pdf" → patientLocalId: "1002500515")
5. CLEAN UP GARBAGE: If any extracted value looks garbled, corrupted, or contains random characters (e.g., "ESEEESNSH", "Gendor:Se"), REPLACE IT WITH null. Valid names contain only letters, spaces, and common characters like . ' -
6. OBSERVATIONS: For lab results, use the actual unit from the document. If value/unit are garbled (e.g., unit="Patient"), use null for that observation

## REQUIRED FIELDS

### Patient Info
- patientName: Full name from document
- patientLocalId: UHID, Patient ID, Lab ID, Registration No (or from filename)
- patientGender: male/female/other
- patientDob: Date of birth (YYYY-MM-DD)

### Facility Info
- hospitalName: Hospital/Lab name
- hospitalAddress: Full address
- attendingPhysician: Doctor name with qualification

### For DIAGNOSTIC REPORTS (Lab Reports)
- testName: Main test/battery name (e.g., "CBC", "KFT", "LFT")
- observationDate: Report date (YYYY-MM-DD)
- observations: Array of test results:
  [{"name": "Hemoglobin", "value": "13.5", "unit": "g/dL", "referenceRange": "13-17 g/dL"}]
- interpretation: Doctor's comments

### For DISCHARGE SUMMARIES
- admissionDate: Date of admission (YYYY-MM-DD)
- dischargeDate: Date of discharge (YYYY-MM-DD)
- chiefComplaint: Reason for admission
- finalDiagnosis: Primary diagnosis
- procedureDone: Surgery/procedure performed
- medications: Discharge medications

### Insurance (if present)
- payerName: Insurance company
- policyNumber: Policy number
- memberId: Member ID

## OUTPUT FORMAT
Return ONLY valid JSON:
{"hiType":"diagnostic_report","extracted":{"patientName":"JOHN DOE","patientLocalId":"1002500515","patientGender":"male","hospitalName":"City Lab","testName":"CBC","observationDate":"2026-01-26","observations":[{"name":"Hemoglobin","value":"13.5","unit":"g/dL"}]}}

Now extract JSON:
`.trim();
}

export { buildEnrichmentPrompt };
