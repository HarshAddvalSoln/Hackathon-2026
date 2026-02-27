/**
 * LLM Enrichment Prompt Builder
 *
 * Extracts structured data from clinical documents for NHCX/FHIR claim submission
 * Handles Diagnostic Reports (Lab Reports) and Discharge Summaries
 */

function buildEnrichmentPrompt(text, hiType) {
  const hiTypeDisplay = hiType === "diagnostic_report"
    ? "Diagnostic Report (Lab Report)"
    : hiType === "discharge_summary"
      ? "Discharge Summary"
      : "Unknown - determine from document content";

  return `
You are an expert medical document parser for ABDM/NHCX healthcare interoperability in India.

## TASK
Extract ALL structured clinical data from the document for FHIR R4 bundle generation for claim submission.

## DOCUMENT TYPE
${hiTypeDisplay}

## INPUT DOCUMENT
${text}

## CRITICAL RULES
1. Extract ONLY what is explicitly stated - DO NOT guess, infer, or fabricate
2. Use null for missing fields - never use empty strings or placeholder values
3. All dates must be in ISO format (YYYY-MM-DD)
4. Extract ALL lab observations from diagnostic reports - no matter how many
5. Preserve original values as shown in document

## COMMON FIELDS (ALL DOCUMENTS)

### Patient Information
- patientName: Full name as written (e.g., "VINEET KUMAR")
- patientLocalId: Patient ID, UHID, Registration No., Lab ID (e.g., "1002500515", "FEHI-2018-0001234")
- patientGender: male/female/other (normalize M, MALE → male)
- patientDob: Date of birth if mentioned, otherwise null
- patientAddress: Patient address if present

### Hospital/Lab Information
- hospitalName: Hospital or Lab name (e.g., "SRL", "Fortis Escorts Heart Institute")
- hospitalAddress: Full address of facility

### Doctor Information
- attendingPhysician: Doctor name with qualification (e.g., "DR. ASHOK KUMAR SEKHON")
- physicianRegNo: Registration number if mentioned

### Insurance (if present)
- payerName: Insurance company name
- policyNumber: Policy number
- memberId: Member ID

## FOR DIAGNOSTIC REPORTS (Lab Reports)

Extract these additional fields:
- testName: Main test/battery name (e.g., "CBC", "LIPID PROFILE")
- observationDate: Collection date or test date (format: DD-MM-YYYY or DD/MM/YYYY)
- interpretation: Doctor's interpretation or comments
- observations: Array of ALL test results with format:
  [{"name": "Hemoglobin", "value": "13.5", "unit": "g/dL", "referenceRange": "13-17 g/dL"}]

For each observation, extract: name, value, unit, referenceRange (if available)

## FOR DISCHARGE SUMMARIES

Extract these additional fields:
- admissionDate: Date of admission (DD-MM-YYYY)
- dischargeDate: Date of discharge (DD-MM-YYYY)
- chiefComplaint: Reason for admission / presenting complaint
- finalDiagnosis: Primary diagnosis at discharge
- procedureDone: Procedure/surgery performed
- medications: Discharge medications (extract all)
- followUp: Follow-up instructions

## DATE CONVERSION
Input formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
Output format: YYYY-MM-DD

Example: 26-01-2026 → 2026-01-26

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanations):

{
  "hiType": "diagnostic_report" | "discharge_summary",
  "extracted": {
    "patientName": "string or null",
    "patientLocalId": "string or null",
    "patientGender": "string or null",
    "patientDob": "YYYY-MM-DD or null",
    "patientAddress": "string or null",
    "hospitalName": "string or null",
    "hospitalAddress": "string or null",
    "attendingPhysician": "string or null",
    "physicianRegNo": "string or null",
    "admissionDate": "YYYY-MM-DD or null",
    "dischargeDate": "YYYY-MM-DD or null",
    "chiefComplaint": "string or null",
    "finalDiagnosis": "string or null",
    "procedureDone": "string or null",
    "medications": "string or null",
    "followUp": "string or null",
    "testName": "string or null",
    "observationDate": "YYYY-MM-DD or null",
    "interpretation": "string or null",
    "payerName": "string or null",
    "policyNumber": "string or null",
    "memberId": "string or null",
    "observations": [{"name": "string", "value": "string", "unit": "string", "referenceRange": "string or null"}] or []
  }
}

## EXAMPLES

LAB REPORT Example:
Patient: VINEET KUMAR, ID: 1002500515, Test: CBC, Date: 26-01-2026, Hb: 13.5 g/dL, WBC: 6800 cells/cumm

Output:
{"hiType":"diagnostic_report","extracted":{"patientName":"VINEET KUMAR","patientLocalId":"1002500515","testName":"CBC","observationDate":"2026-01-26","observations":[{"name":"Hemoglobin","value":"13.5","unit":"g/dL"},{"name":"WBC","value":"6800","unit":"cells/cumm"}]}}

DISCHARGE SUMMARY Example:
Patient: MANOJ KUMAR, 55Y MALE, UHID: FEHI-2018-0001234, Adm: 08-12-2025, Dis: 11-12-2025, Dr. Ashok Kumar, Diagnosis: CAD, Procedure: Angiography

Output:
{"hiType":"discharge_summary","extracted":{"patientName":"MANOJ KUMAR","patientLocalId":"FEHI-2018-0001234","patientGender":"male","admissionDate":"2025-12-08","dischargeDate":"2025-12-11","attendingPhysician":"Dr. Ashok Kumar","finalDiagnosis":"CAD","procedureDone":"Angiography"}}

---

Now extract ALL data from the document:
`.trim();
}

export { buildEnrichmentPrompt };
