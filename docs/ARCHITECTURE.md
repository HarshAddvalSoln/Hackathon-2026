# Healthcare FHIR Conversion System - Architecture

## Overview

This system converts healthcare documents (discharge summaries, diagnostic reports) into NHCX-compliant FHIR bundles for the ABDM (Ayushman Bharat Digital Mission) ecosystem.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                   Document Upload / FHIR Viewer                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Server (Node.js)                        │
│              /v1/claims/convert Endpoint                        │
│         Controllers → Services → Pipeline Orchestration         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Pipeline (5 Stages)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Classification    →  2. Extraction  →  3. Enrichment       │
│  (Doc Classifier)       (PDF/OCR)         (LLM Fallback)       │
│                                                                  │
│  4. Mapping            →  5. Validation                         │
│  (FHIR Mapper)          (Validator + Compliance)                │
└──────────┬──────────────────┬─────────────────┬──────────────────┘
           │                  │                 │
           ▼                  ▼                 ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ Doc Classifier  │ │ Extraction      │ │ LLM Fallback         │
│ Package         │ │ Engine          │ │ (Ollama/Gemma3)      │
└──────────────────┘ └─────────────────┘ └──────────────────────┘
           │                  │                 │
           ▼                  ▼                 ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ Clinical        │ │ OCR Worker      │ │ FHIR Validator       │
│ Extractor       │ │ (MedGemma)      │ │ Package              │
└──────────────────┘ └─────────────────┘ └──────────────────────┘
```

## Package Structure

### Apps (Entry Points)

| App | Description | Port |
|-----|-------------|------|
| `apps/api` | REST API server | 3000 |
| `apps/ocr-worker` | OCR processing worker | 8081 |
| `apps/frontend` | React dashboard | 5173 |

### Packages (Business Logic)

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared utilities, logging, errors, constants |
| `packages/pipeline` | Main conversion pipeline orchestrator |
| `packages/fhir-mapper` | Maps extracted data to NHCX FHIR bundles |
| `packages/extraction-engine` | PDF text extraction (digital + OCR) |
| `packages/clinical-extractor` | Regex-based clinical entity extraction |
| `packages/doc-classifier` | Document type classification |
| `packages/llm-fallback` | LLM enrichment for incomplete extractions |
| `packages/fhir-validator` | FHIR bundle validation |
| `packages/compliance` | NRCeS compliance checks |
| `packages/quality` | Document quality scoring |
| `packages/config` | Centralized configuration |

## Data Flow

1. **Document Upload**: User uploads PDF/image through frontend or API
2. **Classification**: Document type is determined (discharge_summary vs diagnostic_report)
3. **Extraction**: Text is extracted using PDF.js (digital) or OCR (MedGemma)
4. **Enrichment**: LLM (Gemma3) fills in missing fields if extraction is incomplete
5. **Mapping**: Extracted data is mapped to NHCX-compliant FHIR resources
6. **Validation**: FHIR bundle is validated and compliance checks are run
7. **Response**: FHIR bundle is returned to client

## Key Technologies

- **Runtime**: Node.js
- **FHIR**: R4, NHCX profiles
- **OCR**: MedGemma via Ollama
- **LLM**: Gemma3 (Ollama)
- **PDF**: PDF.js
- **Validation**: FHIR R4 validator
