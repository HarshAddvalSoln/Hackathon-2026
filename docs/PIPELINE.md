# Pipeline Documentation

## Overview

The conversion pipeline orchestrates the complete flow from document upload to FHIR bundle generation through 5 sequential stages.

## Pipeline Stages

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. CLASSIFY │───▶│  2. EXTRACT  │───▶│ 3. ENRICH   │
└──────────────┘    └──────────────┘    └──────────────┘
                                                  │
       ┌─────────────────────────────────────────┘
       ▼
┌──────────────┐    ┌──────────────┐
│ 4.   MAP    │───▶│ 5. VALIDATE  │
└──────────────┘    └──────────────┘
```

---

## Stage 1: Classification

**Purpose**: Determine document type (HI Type)

**Input**: Document text
**Output**: Document with `hiType` property

**Logic**:
- Uses regex patterns to identify document type
- Classifies as `discharge_summary`, `diagnostic_report`, or `other`

**Key Files**:
- `packages/doc-classifier/src/index.js`

---

## Stage 2: Extraction

**Purpose**: Extract text and structured clinical data

**Input**: Document (file path, base64, or image)
**Output**: Extracted text and metadata

**Strategies**:
1. **Digital-First** (default): Try PDF.js first, fallback to OCR
2. **OCR-First**: Force OCR for all PDFs
3. **Scan-Only**: Use OCR only

**Extracted Data**:
- Patient demographics
- Hospital/facility info
- Dates (admission, discharge)
- Diagnoses
- Procedures
- Medications
- Lab results/observations

**Key Files**:
- `packages/extraction-engine/src/index.js`
- `packages/clinical-extractor/src/index.js`

---

## Stage 3: Enrichment

**Purpose**: Fill missing data using LLM

**Input**: Extracted data, text
**Output**: Enriched extracted data

**Conditions**:
- Quality score is not "pass"
- LLM fallback is available
- Text length >= 100 chars

**LLM**: Gemma3 via Ollama

**Enriched Fields**:
- Patient name
- Dates
- Diagnoses
- Lab observations
- Insurance details

**Key Files**:
- `packages/llm-fallback/src/index.js`
- `packages/quality/src/index.js`

---

## Stage 4: Mapping

**Purpose**: Convert extracted data to FHIR resources

**Input**: Enriched extracted data, hiType
**Output**: FHIR Bundle

**For discharge_summary**:
- Patient
- Organization
- Practitioner
- Encounter
- Condition
- Composition
- Coverage
- DocumentReference

**For diagnostic_report**:
- Patient
- Organization
- Practitioner
- Encounter
- DiagnosticReport
- Observation[]
- Coverage
- DocumentReference

**Key Files**:
- `packages/fhir-mapper/src/index.js`
- `packages/fhir-mapper/src/resources/*.js`

---

## Stage 5: Validation

**Purpose**: Verify FHIR compliance and quality

**Input**: FHIR Bundle
**Output**: Validation result

**Checks**:
- FHIR R4 schema validation
- NHCX profile conformance
- Required resources present
- Reference integrity

**Key Files**:
- `packages/fhir-validator/src/index.js`
- `packages/compliance/src/index.js`

---

## API Usage

```javascript
const { convertClaimDocuments } = require('./packages/pipeline/src/index');

const result = await convertClaimDocuments({
  claimId: 'CLM-2024-001',
  documents: [
    {
      fileName: 'discharge.pdf',
      filePath: '/path/to/discharge.pdf'
    }
  ],
  hospitalId: 'HOSP-001',
  extractionEngine,  // optional
  llmFallback       // optional
});

console.log(result.bundles);
console.log(result.metadata);
```

---

## Error Handling

| Error Code | Description | HTTP Status |
|------------|-------------|--------------|
| `INVALID_INPUT` | Request validation failed | 400 |
| `DOCUMENT_EXTRACTION_FAILED` | OCR/text extraction failed | 422 |
| `VALIDATION_ERROR` | FHIR validation failed | 422 |
| `CONVERSION_FAILED` | General pipeline failure | 500 |

---

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `documentConcurrency` | 3 | Concurrent documents |
| `llmEnrichmentMinTextLength` | 100 | Min text for LLM |
| `maxObservationsPerReport` | 50 | Max observations |
| `ocrForAllPdfs` | false | Force OCR for all PDFs |
