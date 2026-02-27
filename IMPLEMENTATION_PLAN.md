# Clinical Documents to FHIR Structured Data Converter

## 1) Goal and Scope

Build an open-source Node.js solution (microservice-first, library-friendly) that ingests multiple healthcare PDFs for a claim case, detects HI type (`Diagnostic Report`, `Discharge Summary`), extracts structured fields, and outputs ABDM/NHCX-aligned FHIR bundles for **one selected use case** (recommended: **Claim Submission**).

This plan prioritizes:
- High extraction accuracy
- Fast processing throughput
- Config-driven behavior for reuse across HMIS/hospitals
- Production-style monorepo structure similar to `commander-platform` patterns

## 2) Non-Goals (MVP)

- Full support for every hospital document format in v1
- End-to-end payer integration
- Generic NLP model training pipeline

## 3) Recommended Technical Decisions

### 3.1 Extraction Strategy (Accuracy + Speed)
- Primary path (digital PDFs): `pdfjs-dist` with coordinate-level token extraction
- OCR path (scanned PDFs): PaddleOCR sidecar service (fallback to Tesseract optional)
- Table-heavy diagnostic reports: coordinate-based row/column reconstruction
- Rule-first extraction with confidence scoring; ML assist only for ambiguous fields

### 3.2 Validation
- JSON Schema + FHIR structural checks
- Profile conformance checks for selected ABDM/NHCX use-case resources
- Output confidence + error/warning report

### 3.3 Processing Model
- Asynchronous jobs for multi-PDF claim cases
- Queue + worker architecture
- Idempotent processing by document hash

## 4) Monorepo Directory Structure (Commander-style)

```text
hackathon-fhir-converter/
  apps/
    api/
      src/
        modules/
          ingest/
          classify/
          extract/
          map-fhir/
          validate/
          jobs/
          health/
        common/
        main.ts
      test/
      package.json
    worker/
      src/
        jobs/
        pipelines/
        adapters/
      test/
      package.json
    ocr-service/
      src/
        server.ts
        preprocess/
        ocr/
      Dockerfile
      package.json
  packages/
    config/
      src/
        hospital-templates/
        extraction-rules/
        fhir-mappings/
      package.json
    core-domain/
      src/
        entities/
        types/
        constants/
      package.json
    pdf-engine/
      src/
        pdfjs/
        tokenizer/
        layout/
      package.json
    ocr-engine/
      src/
        paddle/
        medgemma/
      package.json
    doc-classifier/
      src/
        rules/
        features/
      package.json
    clinical-extractor/
      src/
        discharge-summary/
        diagnostic-report/
        normalizers/
      package.json
    fhir-mapper/
      src/
        resources/
        bundle/
        profile-adapters/
      package.json
    fhir-validator/
      src/
        schema/
        profile/
        reporters/
      package.json
    shared-utils/
      src/
      package.json
    observability/
      src/
      package.json
  infra/
    docker/
      docker-compose.yml
    k8s/
      api/
      worker/
      ocr/
    terraform/
  docs/
    architecture/
    api/
    profiles/
    runbooks/
  test-data/
    samples/
      claim-submission/
        discharge-summary/
        diagnostic-report/
    golden/
      expected-fhir-bundles/
  scripts/
    dev/
    ci/
  .github/
    workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  README.md
```

## 5) Service and Package Responsibilities

### apps/api
- Public REST API
- Request validation
- Job submission and retrieval
- Synchronous fast path for small files (optional)

### apps/worker
- Queue consumers
- Pipeline orchestration per claim case
- Retry and failure policies

### apps/ocr-service
- OCR endpoint for scanned pages
- Image preprocessing before OCR

### packages/*
- Keep core logic framework-agnostic and testable
- Reusable as library by HMIS integrators

## 6) API Contract (Claim Submission Use Case)

### POST `/v1/claims/convert`
Request:
- `useCase`: `"claim_submission"`
- `hospitalId`: string
- `documents[]`: multipart PDFs
- `metadata`: optional (claim id, encounter id, patient hints)

Response:
- `jobId`
- `status`: `queued`

### GET `/v1/claims/convert/:jobId`
Response:
- `status`: `queued|processing|completed|failed`
- `outputs` (when completed):
  - `bundle`: FHIR Bundle JSON
  - `validationReport`
  - `extractionReport`
  - `documentClassification`

### GET `/health`
- Liveness/readiness probes

## 7) End-to-End Processing Pipeline

1. Ingest
- Store raw PDFs (object store/local dev storage)
- Generate `sha256` for dedupe/idempotency

2. Page Type Detection
- Digital text available vs scanned image pages

3. Text/Token Extraction
- Digital: `pdfjs-dist` tokens with coordinates
- Scanned: OCR service returns text blocks + confidence + bounding boxes

4. Document Classification
- Rule-based heading/features to identify HI type:
  - Discharge Summary
  - Diagnostic Report

5. Section Segmentation
- Parse major sections and contextual blocks

6. Field Extraction
- Patient identifiers, demographics
- Encounter/admission/discharge timelines
- Diagnoses
- Investigations and results
- Procedures
- Medications and discharge advice

7. Normalization
- Dates, units, numeric values, naming cleanup
- Optional code mapping where feasible

8. FHIR Mapping
- Build resources and references
- Assemble Bundle for claim submission profile flow

9. Validation
- Structure + profile conformance
- Fail/partial policy controlled by config

10. Output + Audit
- Return final bundle + confidence + unmapped/missing fields
- Preserve traceability source spans per extracted field

## 8) Configuration-Driven Design

Store rules/mappings in `packages/config/src`:
- `hospital-templates/*.yaml`
- `extraction-rules/*.yaml`
- `fhir-mappings/*.yaml`

Config should support:
- Heading synonyms
- Regex/entity patterns
- Coordinate anchors for fixed-layout reports
- Required/optional field policy by use case
- Resource mapping templates by HI type

## 9) Data Model (Internal)

Core internal entities:
- `ClaimCase`
- `ClinicalDocument`
- `DocumentClassification`
- `ExtractedField` (value, confidence, sourceSpan, normalizer, errors)
- `StructuredClinicalRecord`
- `FhirMappingResult`
- `ValidationResult`

## 10) Accuracy and Performance Plan

### Accuracy Controls
- Multi-pass extraction: section-first then field extraction
- Confidence thresholds with fallback extraction strategy
- Golden dataset comparisons (expected FHIR)
- Human-readable extraction report for review

### Performance Controls
- Queue workers with bounded concurrency
- Page-level parallelism for OCR-heavy docs
- Caching OCR/text by file hash
- Streaming upload and non-blocking IO

Target MVP benchmarks (define and measure):
- p50 processing time per 5-page digital PDF
- p95 processing time per mixed claim packet
- Field-level precision/recall on test set

## 11) Security and Compliance Basics

- No hardcoded secrets; env-based configuration
- Encrypted storage/transport in deployed environments
- PII-safe logs (mask identifiers)
- Optional retention policy and purge job

## 12) Testing Strategy

### Unit Tests
- Classifier rules
- Section parsers
- Field normalizers
- FHIR mappers

### Integration Tests
- Full pipeline by document type
- Multi-PDF claim packet

### Contract Tests
- API request/response schemas

### Golden Tests
- Input PDFs -> stable expected Bundle outputs

### Performance Tests
- Load tests on worker queue and OCR path

## 13) CI/CD and Quality Gates

Pipeline stages:
1. Lint + typecheck
2. Unit/integration tests
3. Bundle validation tests
4. Build artifacts
5. Container image build

Quality gates:
- Minimum coverage threshold
- No critical validation regressions on golden set
- Basic performance budget checks

## 14) Observability

- Structured logs with correlation id (`jobId`, `claimId`)
- Metrics:
  - extraction duration by stage
  - OCR invocation rate
  - classification accuracy snapshot
  - validation failure count
- Traces across API -> worker -> OCR -> mapper

## 15) Open-Source Readiness

- Apache-2.0 or MIT license
- Contributor guide + architecture docs
- Sample configs and test PDFs
- Reproducible local setup (`docker-compose`)
- Clear extension guide for new hospital templates

## 16) Detailed Implementation Phases

### Phase 0: Bootstrap (Day 1)
- Initialize monorepo (pnpm + turbo + tsconfig base)
- Scaffold apps/packages
- Add lint/test/build tooling
- Add local infra (`docker-compose`: api, worker, redis, ocr)

Deliverable:
- Running skeleton with health endpoints

### Phase 1: Ingestion + Queue (Day 1-2)
- Multipart upload endpoint
- Persist files and create jobs
- Worker consumes jobs and tracks state

Deliverable:
- End-to-end job lifecycle without extraction

### Phase 2: PDF/OCR Engine (Day 2-3)
- Implement digital text extraction package
- Integrate OCR sidecar for scanned docs
- Add page-type detection logic

Deliverable:
- Unified text/tokens output model for both paths

### Phase 3: HI Type Classification (Day 3)
- Build rule-based classifier for two document types
- Add confidence and explainability fields

Deliverable:
- Correct classification on sample set

### Phase 4: Extraction + Normalization (Day 3-4)
- Implement discharge summary extractor
- Implement diagnostic report extractor (including table logic)
- Add normalization utilities

Deliverable:
- Structured intermediate JSON for both HI types

### Phase 5: FHIR Mapping + Validation (Day 4-5)
- Map to selected claim-submission FHIR resources
- Assemble Bundle with references
- Validate and emit report

Deliverable:
- NHCX-aligned bundle output for sample claims

### Phase 6: Config-Driven Templates (Day 5)
- Move rules/mappings to YAML config
- Add template selection by `hospitalId`

Deliverable:
- Same code supports multiple document patterns via config

### Phase 7: Test Hardening + Benchmarking (Day 6)
- Golden dataset tests
- Performance baseline report
- Error handling and retries

Deliverable:
- Stable demo-ready system with quality metrics

### Phase 8: Demo and Documentation (Day 6-7)
- Final README, API docs, architecture diagrams
- Demo script with sample claim packet
- Submission package prep

Deliverable:
- Hackathon-ready repository and walkthrough

## 17) Risk Register and Mitigation

Risk: low OCR quality on noisy scans  
Mitigation: preprocessing, confidence fallback, manual-review flags

Risk: varied hospital templates  
Mitigation: config-driven extractor + anchor rules

Risk: profile mismatch in output  
Mitigation: strict validator in CI + golden test bundles

Risk: slow OCR on large PDFs  
Mitigation: page-level concurrency, caching, job queue scaling

## 18) Team Task Split (Suggested)

- Engineer A: API + queue + orchestration
- Engineer B: PDF/OCR + classifier + extraction
- Engineer C: FHIR mapper + validator + golden tests
- Engineer D: infra + observability + docs/demo

## 19) Definition of Done (MVP)

- Accepts multi-PDF claim input
- Correctly classifies discharge summary vs diagnostic report
- Produces valid FHIR bundle for selected use case
- Exposes confidence/validation reports
- Config-driven for at least 2 sample document templates
- Open-source repo with reproducible setup and test data

## 20) Immediate Next Commands (Execution Checklist)

1. Initialize monorepo:
- `pnpm init`
- `pnpm add -D turbo typescript eslint vitest`

2. Create workspace config:
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`

3. Scaffold services/packages from section 4.

4. Start infra locally:
- Redis + OCR service + API + worker via Docker Compose

5. Implement first vertical slice:
- upload one discharge summary PDF -> extract core fields -> map to minimal FHIR bundle -> validate -> return output.

## 21) NRCeS EHR 2016 Compliance Mapping (Applied to This Design)

Source reviewed: `/Users/gourav/Desktop/nrces_ehr_stand_india.pdf` (56 pages).  
Working extraction log: `/Users/gourav/Documents/Hackathon/nrces_ehr_stand_india_extracted.txt`.

This section maps key **normative rules** (`must`, `shall`, `required`, compulsory) to implementation controls.

### 21.1 Patient Identification and Demographics

Rule:
- Unique patient identifier is necessary; Aadhaar preferred where available; fallback local ID + government photo ID.

Design controls:
- `Patient.identifier[]` in FHIR with typed identifiers and source system tags.
- Config policy per hospital for accepted identifier combinations.
- Validation rule: reject/flag records missing required identifier combination.

### 21.2 Architecture and Functional Requirements

Rule:
- Health record system **must** meet architectural and functional requirements for service delivery, clinical validity, legal and ethical requirements.

Design controls:
- Modular architecture (`apps/*`, `packages/*`) with separation of ingestion, extraction, mapping, validation.
- Mandatory conformance tests before release.
- Audit-ready evidence bundle (logs + validation report + extraction trace).

### 21.3 Clinical Event Capture and Standardized Structure

Rule:
- System **must** accumulate clinically relevant encounter/event data; artifacts should use common semantic/syntactic model.

Design controls:
- Intermediate canonical model (`StructuredClinicalRecord`) before FHIR mapping.
- Field-level schema validation and normalization.
- Required extraction for encounter timeline, diagnosis, investigations, treatment/discharge data.

### 21.4 Terminology and Coding

Rule:
- Common terminology standards necessary; SNOMED CT/LOINC/WHO classifications recommended.

Design controls:
- Terminology mapper package for SNOMED CT (problems/findings) and LOINC (lab tests) where available.
- `code.coding[]` retains both source code and mapped coding.
- Unmapped terms preserved with confidence and reason; no silent drop.

### 21.5 Discharge/Treatment Summary Format

Rule:
- Discharge/treatment summary should meet MCI-prescribed format expectations.

Design controls:
- Discharge-summary extractor with required section coverage template:
  - demographics
  - admission/discharge dates
  - diagnosis
  - procedures/interventions
  - medications/advice/follow-up
- Coverage checker to report missing mandatory sections.

### 21.6 Data Immutability, As-Is Retrieval, Versioning

Rule:
- Data once entered **must become immutable**.
- Original “as-is” should remain retrievable.
- Updates/append only with complete audit trail and versioning.

Design controls:
- Store original PDF and immutable extraction snapshots by content hash.
- Versioned conversion outputs (`v1`, `v2`, ...), never overwrite.
- Event-sourced audit table: who/when/what changed, with before/after refs.

### 21.7 Informed Format Change and SOP

Rule:
- Conversion/format change should happen with explicit consent; conversion rules declared in SOP.

Design controls:
- Config repository acts as versioned SOP (rules/mappings YAML with changelog).
- Conversion response includes rule-set version id.
- API requires actor metadata; records consent/context metadata when provided.

### 21.8 Privacy, Confidentiality, and Patient Rights

Rule:
- Explicit consent should be audited for access/disclosure.
- Patient amendment rights limited to correction of errors.
- Audit trail must be maintained for all changes.

Design controls:
- Consent artifact persisted per request/job (`consentRef`, `purpose`, `timestamp`).
- Access and update endpoints enforce role policy and operation constraints.
- Full audit logging for create/read/update/export actions.

### 21.9 Disclosure and De-identification

Rule:
- Disclosure without consent only in specified legal/public-health contexts.
- Remove patient-identifying information where not necessary.

Design controls:
- Purpose-of-use on all export APIs (`claim_submission`, etc.).
- De-identification mode for non-treatment exports.
- Policy engine to block unauthorized disclosure contexts.

### 21.10 Record Preservation

Rule:
- Records must be preserved and not destroyed during patient lifetime.

Design controls:
- Soft-delete only for operational artifacts; immutable clinical source and outputs retained.
- Retention policies prevent destructive deletion of clinical evidence.
- Backup + restore tests as a CI gate for storage durability.

### 21.11 Security Technical Controls

Rule:
- Session timeout (auto log-off) must be enforced.
- Access control and privilege management required.
- All actions must be audit logged with user, time, action.
- Integrity and encryption required for transit and storage.

Design controls:
- OIDC/JWT auth with inactivity timeout and token expiry.
- RBAC/ABAC policy layer for API + worker operations.
- Audit schema includes `timestamp`, `userId`, `recordId`, `action`, `outcome`.
- TLS for all service hops, encrypted-at-rest storage, checksum verification on files.

### 21.12 Administrative and Physical Safeguards

Rule:
- Security SOPs, incident procedures, contingency planning, workforce controls required.

Design controls:
- Runbooks in `docs/runbooks/`: incident response, key rotation, backup recovery.
- Mandatory security checklist for release.
- Access onboarding/offboarding process and periodic access review.

## 22) Compliance Acceptance Criteria (Must Pass Before Submission)

1. Every conversion job stores immutable source document + immutable output versions.
2. Every read/export/update action produces an audit log record.
3. Role/permission checks prevent unauthorized access to PHI.
4. Consent metadata is captured and queryable for claim workflows.
5. FHIR bundle includes patient identifiers with configured minimum identifier policy.
6. Discharge summary and diagnostic report minimum required sections are validated.
7. Terminology mapping pipeline preserves source terms and mapped codings.
8. Data-in-transit and data-at-rest encryption are enabled in deployment configs.
9. De-identification export mode is available and tested.
10. Golden tests prove stable extraction + mapping behavior for sample claim packets.
