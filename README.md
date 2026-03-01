# Clinical Documents to FHIR Converter (ABDM/NHCX)

GitHub Repository: [https://github.com/HarshAddvalSoln/Hackathon-2026](https://github.com/HarshAddvalSoln/Hackathon-2026)

Open-source Node.js service for converting PDF-derived clinical content (Discharge Summary and Diagnostic Report) into NHCX-aligned FHIR claim bundles.

## What This Solves

- Converts unstructured clinical document content into structured FHIR.
- Supports claim-submission workflow with multi-document input.
- Multiple OCR engines for text extraction from PDFs/images.
- LLM-powered enrichment for improved data extraction accuracy.
- Produces:
  - `FHIR Bundle`
  - `complianceReport` (NRCeS-focused checks)
  - `validationReport` (bundle/resource-level checks)
  - `extractionReports` (confidence + missing fields)

## Current Capability

- **HI type detection:**
  - `discharge_summary`
  - `diagnostic_report`
- **Config-driven hospital templates:**
  - `default`
  - `hsp-alpha` (alias support like `IP No`, `Diagnosis at Discharge`)
- **Multiple OCR Engines:**
  - MedGemma (LLaVA-based vision model via Ollama) - primary
  - Tesseract.js - fallback
  - PaddleOCR - fallback
- **LLM Enrichment:**
  - Uses Ollama for data extraction enrichment
  - Supports MedGemma, Gemma 3, and other models
  - Automatic fallback when primary model unavailable
- **Strict request validation** with field-level errors.
- **TDD-first coverage** across pipeline, API, compliance, validation, and benchmark/demo scripts.

## Project Layout

```text
apps/
  api/                    # Express API server
  frontend/               # React + Vite frontend
  ocr-worker/             # OCR processing service
packages/
  clinical-extractor/     # Extracts structured data from text
  compliance/             # NRCeS compliance checks
  config/                 # Hospital templates and configuration
  doc-classifier/          # HI type classification
  extraction-engine/       # Text extraction orchestration
  fhir-mapper/             # Maps to FHIR ClaimSubmission bundle
  fhir-validator/         # FHIR bundle validation
  llm-fallback/           # LLM enrichment via Ollama
  pipeline/               # Main conversion pipeline orchestrator
  quality/                # Quality evaluation
  shared/                 # Shared utilities
```

## Quick Start

### Prerequisites

- Node.js 20+ and npm/pnpm
- Ollama (for MedGemma OCR and LLM enrichment)

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

**OCR Engine Selection:**

```bash
OCR_ENGINE=medgemma  # Options: medgemma, tesseract, paddle
```

**MedGemma OCR Configuration:**

```bash
MEDGEMMA_BASE_URL=http://127.0.0.1:11434
MEDGEMMA_MODEL=dcarrascosa/medgemma-1.5-4b-it:Q8_0
OCR_MAX_PAGES=5
OCR_PDF_DPI=300
OCR_PAGE_CONCURRENCY=2
MEDGEMMA_REQUEST_TIMEOUT_MS=180000
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

# Pull models
ollama pull dcarrascosa/medgemma-1.5-4b-it:Q8_0
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

- OCR-first path for PDFs/images (MedGemma by default)
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

## Architecture Overview

### OCR Processing Flow

1. **Input**: PDF, image (PNG/JPG), or base64-encoded content
2. **Engine Selection**: Configurable via `OCR_ENGINE` env var
3. **Processing**:
   - PDF → Convert to PNG pages via pdftoppm
   - Images → Process directly
4. **Output**: Extracted text with confidence score

### LLM Enrichment Flow

1. **Trigger**: Automatic on low quality scores or for diagnostic reports
2. **Model**: Uses Ollama (configurable model)
3. **Enhancement**: Fixes OCR errors, extracts additional fields
4. **Merge**: Combines with base extraction, preferring non-empty values

### FHIR Mapping

- Converts structured extraction to NHCX-aligned ClaimSubmission bundle
- Includes Patient, Encounter, Condition, Observation, DocumentReference
- Generates proper FHIR resource references

## Why This Is Hackathon-Ready

- Aligned to problem statement scope: Claim submission + HI type conversion.
- Config-driven reusability for HMIS/hospital variation.
- Multiple OCR engines for flexibility and reliability.
- Explicit confidence + quality reporting for operational trust.
- LLM-powered enrichment for improved accuracy.
- Traceability artifacts for interoperability and audit expectations.
- Includes benchmark and demo-output tooling for judge walkthrough.
- Supports adapter-based extraction integration (`pdfjs-dist` + OCR worker architecture).

## Next Engineering Extensions

1. Replace stub adapters with production extraction:
   - `pdfjs-dist` token extraction in digital adapter.
   - OCR worker integration in OCR adapter.

2. Expand resource-level FHIR profile checks:
   - `Condition`, `Observation`, `Encounter`, references and cardinality.

3. Add async queue worker + persistent job store for scale.

4. Integrate additional LLM models for specific extraction tasks.
