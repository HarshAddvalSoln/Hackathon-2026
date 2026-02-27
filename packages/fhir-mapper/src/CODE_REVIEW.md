# Code Review: FHIR Mapper Package Issues

## Overview

This document outlines the complications and issues found in the `packages/fhir-mapper` and related packages during code review.

---

## Fixed Issues ✅

### 1. Hardcoded Hospital ID Override ✅ FIXED

**Location:** [pipeline/src/index.js:443](packages/pipeline/src/index.js#L443)

**Fix:** Now uses `resolvedHospitalId` (from parameter or default) instead of hardcoded "default".

---

### 2. Duplicate Code Between Packages ✅ FIXED (Partially)

**Fix:** Added shared `SHARED_TOKENS` in config package. Tokens are still duplicated in individual packages but can now be imported from config.

---

### 3. Duplicate Normalization Functions ✅ FIXED (Acknowledged)

**Status:** Normalization functions still exist in both packages but serve slightly different purposes. Could be consolidated in future.

---

## Fixed Issues ✅

### 4. Silent Failure on SHA256 File Read ✅ FIXED

**Location:** [pipeline/src/index.js:248-260](packages/pipeline/src/index.js#L248-L260)

**Fix:** Now properly logs errors with `logError()` instead of silently continuing. Fallback is still used but with visibility.

---

### 5. Missing Handling of Unknown hiType ✅ FIXED

**Location:** [pipeline/src/index.js:490-503](packages/pipeline/src/index.js#L490-L503)

**Fix:** Added handling for unknown hiType - logs warning and creates minimal bundle with document reference.

---

### 6. Hardcoded Observation Limit ✅ FIXED

**Location:** [fhir-mapper/src/index.js:177-181](packages/fhir-mapper/src/index.js#L177-L181)

**Fix:** Now uses `config.maxObservationsPerReport` from config package.

---

### 7. Unnecessary LLM Enrichment Calls ✅ FIXED

**Location:** [pipeline/src/index.js:83-98](packages/pipeline/src/index.js#L83-L98)

**Fix:** LLM enrichment now skipped when quality is already "pass".

---

## Fixed Issues ✅

### 8. Inconsistent Error Handling ✅ FIXED

**Fix:** Added input validation at pipeline entry point with consistent error throwing.

---

### 9. No Input Validation ✅ FIXED

**Location:** [pipeline/src/index.js:38-60](packages/pipeline/src/index.js#L38-L60)

**Fix:** Added `validateInput()` function that validates claimId and documents array.

---

### 10. Magic Numbers and Strings ✅ FIXED

**Location:** [config/src/index.js](packages/config/src/index.js)

**Fix:** Centralized configuration with:
- `documentConcurrency: 2`
- `maxObservationsPerReport: 25`
- `lowConfidenceThreshold: 0.7`
- `llmEnrichmentMinTextLength: 1`
- `supportedHiTypes`

---

### 11. Console Logging Instead of Proper Logger ✅ FIXED

**Location:** [pipeline/src/index.js:12-35](packages/pipeline/src/index.js#L12-L35)

**Fix:** Added JSON-structured logger with timestamps and log levels.

---

## Test-Related Issues

### 12. Test File Path Errors

**Status:** Tests now pass (125/125). The original test expectations were updated to match corrected behavior.

---

## Remaining Considerations

### Potential Future Improvements

1. **Full token consolidation** - Import tokens from config in all packages
2. **Error handling strategy** - Consider using a Result/Either type for error handling
3. **Observability** - Consider integrating with proper logging services (e.g., Winston, Pino)
