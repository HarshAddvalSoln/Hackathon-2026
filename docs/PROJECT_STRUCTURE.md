# Project Structure Documentation

## Overview

This is a **Clinical Documents to FHIR Converter** for ABDM/NHCX ecosystem. It converts PDF clinical documents (Discharge Summary, Diagnostic Reports) into NHCX-compliant FHIR R4 claim bundles.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                        │
├────────────────────────────────┬────────────────────────────────────────────┤
│    Frontend (React)            │    External API Clients                   │
│    http://127.0.0.1:5173       │    POST /v1/claims/convert                │
└────────────┬───────────────────┴────────────────────────────────────────────┘
             │                                    ▲
             │ HTTP                                │ HTTP
             ▼                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API SERVER (Node.js)                             │
│                         http://127.0.0.1:3000                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Routes    │──▶│ Controller  │──▶│  Pipeline   │──▶│   Output    │     │
│  │ validation  │   │             │   │ Orchestrator│   │  FHIR Bundle│     │
│  └─────────────┘   └─────────────┘   └──────┬──────┘   └─────────────┘     │
└─────────────────────────────────────────────┼──────────────────────────────┘
                                              │
                                              │ (optional)
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OCR WORKER (MedGemma)                              │
│                       http://127.0.0.1:8081                                │
│                   (for scanned PDF/image extraction)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Hackathon-2026/
├── apps/                           # Entry points (runnable services)
│   ├── api/                        # REST API server (port 3000)
│   │   └── src/
│   │       ├── server.js           # HTTP server + route handling
│   │       ├── routes/             # API routes
│   │       ├── controllers/        # Request handling
│   │       └── validation.js       # Request validation
│   │
│   ├── frontend/                   # React UI (port 5173)
│   │   └── src/
│   │       ├── App.jsx             # Main React component
│   │       └── main.jsx            # Entry point
│   │
│   └── ocr-worker/                 # OCR processing worker (port 8081)
│       └── src/
│           ├── service.js          # OCR extraction (MedGemma)
│           └── prompts/           # OCR prompts
│
├── packages/                       # Business logic (shared libraries)
│   ├── pipeline/                   # Main orchestrator (5 stages)
│   ├── fhir-mapper/               # Maps to FHIR R4 bundles
│   ├── extraction-engine/         # PDF/text extraction
│   ├── clinical-extractor/       # Regex-based entity extraction
│   ├── doc-classifier/           # Document type classification
│   ├── fhir-validator/           # FHIR bundle validation
│   ├── compliance/               # NRCeS compliance checks
│   ├── quality/                  # Document quality scoring
│   ├── config/                   # Template & config management
│   ├── llm-fallback/             # LLM enrichment (Gemma3/Ollama)
│   └── shared/                   # Utilities, logging, errors
│
└── docs/                          # Documentation
```

---

## Data Flow (Pipeline - 5 Stages)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. INPUT   │────▶│  2. CLASSIFY │────▶│  3. EXTRACT  │
│  API Request │     │   hiType     │     │    Text      │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                    ┌──────────────────────────────┘
                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  5. OUTPUT   │◀────│  4.   MAP    │◀────│  3b. ENRICH  │
│ FHIR Bundle  │     │    FHIR      │     │    LLM       │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Stage Details

| Stage | Package | Purpose | Output |
|-------|---------|---------|--------|
| 1. Input | API Server | Validates request, creates job | Validated documents |
| 2. Classify | `doc-classifier` | Detects `discharge_summary` or `diagnostic_report` | `hiType` |
| 3. Extract | `extraction-engine` + `clinical-extractor` | Extracts text + structured data (patient, diagnosis, etc.) | Extracted data |
| 3b. Enrich | `llm-fallback` | Uses Gemma3 to fill missing fields (if quality < pass) | Enriched data |
| 4. Map | `fhir-mapper` | Converts to NHCX FHIR R4 resources | FHIR Bundle |
| 5. Validate | `fhir-validator` + `compliance` | Validates FHIR + NRCeS compliance | Validation report |

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/claims/convert` | Convert documents to FHIR bundle |
| `GET` | `/v1/claims/convert/:jobId` | Get conversion job status |
| `GET` | `/health` | Health check (API + OCR) |

### Request Example

```json
{
  "claimId": "CLM-1001",
  "hospitalId": "hsp-alpha",
  "documents": [
    {
      "fileName": "discharge-summary.pdf",
      "sha256": "abc123...",
      "text": "DISCHARGE SUMMARY..."
    }
  ]
}
```

### Response Example

```json
{
  "jobId": "uuid",
  "status": "completed",
  "output": {
    "claimId": "CLM-1001",
    "bundles": [ { /* FHIR Bundle */ } ],
    "validationReport": { "status": "valid" },
    "complianceReport": { "status": "passed" }
  }
}
```

---

## Document Type Support

| HI Type | Template Fields | FHIR Resources Generated |
|---------|-----------------|--------------------------|
| `discharge_summary` | patientName, UHID, admissionDate, dischargeDate, finalDiagnosis | Patient, Organization, Practitioner, Encounter, Condition, Composition, Coverage, DocumentReference |
| `diagnostic_report` | patientName, UHID, testName, resultValue, observationDate | Patient, Organization, Practitioner, Encounter, DiagnosticReport, Observation[], Coverage, DocumentReference |

---

## Configuration System

Located in [packages/config/src/index.js](packages/config/src/index.js):

- **Templates**: Hospital-specific field mappings (e.g., `UHID` vs `IP No`)
- **Quality Rules**: Required fields per document type
- **Concurrency**: `documentConcurrency: 2`
- **LLM Settings**: `llmEnrichmentMinTextLength: 1`

---

## How to Run

```bash
# Start all services (API + OCR + Frontend)
npm run start:all

# Individual services
npm run start:api      # API only (port 3000)
npm run start:frontend  # Frontend only (port 5173)
npm run ocr:worker     # OCR worker only (port 8081)
```

---

## Testing

```bash
npm test        # Run all tests
npm run benchmark    # Performance benchmark
npm run demo:generate # Generate demo outputs
```

---

## Validation Layers

1. **Request Validation** - Field presence, format checking
2. **Quality Validation** - Required extracted fields, confidence scores
3. **Compliance Validation** - NRCeS checks (identifier, audit trail)
4. **FHIR Validation** - R4 schema, resource references, profile conformance
