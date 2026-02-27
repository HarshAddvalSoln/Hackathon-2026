# Clinical Documents to FHIR Converter (ABDM/NHCX)

GitHub Repository: [https://github.com/HarshAddvalSoln/Hackathon-2026](https://github.com/HarshAddvalSoln/Hackathon-2026)

Open-source Node.js service for converting PDF-derived clinical content (Discharge Summary and Diagnostic Report) into NHCX-aligned FHIR claim bundles.

## What This Solves

- Converts unstructured clinical document content into structured FHIR.
- Supports claim-submission workflow with multi-document input.
- Produces:
  - `FHIR Bundle`
  - `complianceReport` (NRCeS-focused checks)
  - `validationReport` (bundle/resource-level checks)
  - `extractionReports` (confidence + missing fields)

## Current Capability

- HI type detection:
  - `discharge_summary`
  - `diagnostic_report`
- Config-driven hospital templates:
  - `default`
  - `hsp-alpha` (alias support like `IP No`, `Diagnosis at Discharge`)
- Adapter-based extraction flow:
  - digital adapter path
  - OCR adapter path
- Strict request validation with field-level errors.
- TDD-first coverage across pipeline, API, compliance, validation, and benchmark/demo scripts.

## Project Layout

```text
apps/
  api/
packages/
  clinical-extractor/
  compliance/
  config/
  doc-classifier/
  extraction-engine/
  fhir-mapper/
  fhir-validator/
  pipeline/
  quality/
scripts/
  benchmark.js
  generate-demo-output.js
```

## Quick Start

### Prerequisites
- Node.js 20+ and npm

### Installation
```bash
npm install
```

### Running the Project

#### Option 1: Start All Services (Recommended)
Runs frontend, API, and OCR worker together:
```bash
npm run start:all
```

This starts:
- **API** at `http://127.0.0.1:3000`
- **OCR Worker** at `http://127.0.0.1:8081`
- **Frontend** at `http://127.0.0.1:5173`

Open your browser to `http://127.0.0.1:5173` and upload PDF files to convert them to FHIR format.

#### Option 2: Individual Services

**Backend only (API + OCR):**
```bash
npm run start:backend
```

**Frontend only:**
```bash
npm run start:frontend
```
Then open `http://127.0.0.1:5173`

**API only (includes in-process OCR):**
```bash
npm run start:api
```

**OCR worker only:**
```bash
npm run ocr:worker
```

### Environment Variables (Optional)

Create a `.env` file in the root directory. Default values work for local development.

**OCR Configuration:**
```bash
OCR_MAX_PAGES=5
OCR_PDF_DPI=300
MEDGEMMA_REQUEST_TIMEOUT_MS=60000
MEDGEMMA_PAGE_RETRIES=2
```

**LLM Fallback (Hybrid Extraction):**
```bash
LLM_FALLBACK_ENABLED=true
LLM_FALLBACK_BASE_URL=http://127.0.0.1:11434
LLM_FALLBACK_MODEL=gemma3:4b
LLM_FALLBACK_TIMEOUT_MS=45000
```

First-time Ollama setup:
```bash
# macOS
brew install ollama
brew services start ollama

# Pull the model
ollama pull gemma3:4b
```

### Testing & Demo

**Run tests:**
```bash
npm test
```

**Run benchmark:**
```bash
npm run benchmark
```

**Generate demo outputs:**
```bash
npm run demo:generate
```

## API Contract

### `POST /v1/claims/convert`

Request:
```json
{
  "claimId": "CLM-1001",
  "hospitalId": "hsp-alpha",
  "documents": [
    {
      "fileName": "discharge-summary.pdf",
      "sha256": "hash-1",
      "text": "DISCHARGE SUMMARY ..."
    }
  ]
}
```
`claimId` is optional; if omitted, backend auto-generates one (`CLM-<uuid>`).

If `text` is not sent for a document, pipeline uses in-process extraction engine:
- OCR-first path for PDFs/images (MedGemma)
- No separate OCR worker server required for API usage

Response (single-call conversion, synchronous):
```json
{
  "jobId": "uuid",
  "status": "completed",
  "output": {
    "claimId": "CLM-1001",
    "bundles": []
  }
}
```

### `GET /v1/claims/convert/:jobId`

Optional retrieval endpoint. Response includes:
- `status`
- `output.bundles`
- `output.classifications`
- `output.extractionReports`
- `output.complianceReport`
- `output.validationReport`

## Validation Layers

1. **Request validation** (`apps/api/src/validation.js`)
- Required fields and per-document payload checks.

2. **Quality validation** (`packages/quality`)
- Required extracted field presence.
- Confidence score and low-confidence flags.

3. **Compliance validation** (`packages/compliance`)
- NRCeS-oriented checks (identifier, audit trail, source traceability).

4. **FHIR bundle validation** (`packages/fhir-validator`)
- Bundle profile presence.
- Core resource checks (`Patient`, `DocumentReference`, identifier integrity).
- Resource-link checks (`DiagnosticReport.result` -> `Observation`, subject reference integrity, duplicate IDs).

## Why This Is Hackathon-Ready

- Aligned to problem statement scope: Claim submission + HI type conversion.
- Config-driven reusability for HMIS/hospital variation.
- Explicit confidence + quality reporting for operational trust.
- Traceability artifacts for interoperability and audit expectations.
- Includes benchmark and demo-output tooling for judge walkthrough.
- Supports adapter-based real extraction integration (`pdfjs-dist` + OCR worker architecture).

## Next Engineering Extensions

1. Replace stub adapters with production extraction:
- `pdfjs-dist` token extraction in digital adapter.
- OCR worker integration in OCR adapter.

2. Expand resource-level FHIR profile checks:
- `Condition`, `Observation`, `Encounter`, references and cardinality.

3. Add async queue worker + persistent job store for scale.
