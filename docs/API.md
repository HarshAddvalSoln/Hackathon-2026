# API Documentation

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Check

**GET** `/health`

Check API and OCR worker health status.

**Response:**
```json
{
  "status": "ok",
  "ok": true,
  "ocr": {
    "ok": true
  }
}
```

---

### Convert Claim Documents

**POST** `/v1/claims/convert`

Convert healthcare documents to NHCX-compliant FHIR bundles.

**Request Body:**
```json
{
  "claimId": "CLM-2024-001",
  "hospitalId": "HOSP-001",
  "documents": [
    {
      "fileName": "discharge_summary.pdf",
      "filePath": "/path/to/discharge_summary.pdf"
    }
  ]
}
```

**Alternative with Base64:**
```json
{
  "claimId": "CLM-2024-001",
  "documents": [
    {
      "fileName": "lab_report.pdf",
      "base64Pdf": "JVBERi0xLjQK..."
    }
  ]
}
```

**Response (200):**
```json
{
  "jobId": "uuid-1234-5678",
  "status": "completed",
  "output": {
    "bundles": [
      {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
          { "resource": { "resourceType": "Patient", ... } },
          { "resource": { "resourceType": "Encounter", ... } },
          { "resource": { "resourceType": "DiagnosticReport", ... } }
        ]
      }
    ],
    "metadata": {
      "claimId": "CLM-2024-001",
      "hospitalId": "HOSP-001",
      "documentsCount": 1,
      "successfulCount": 1,
      "failedCount": 0
    }
  }
}
```

**Error Response (400):**
```json
{
  "error": "invalid_request",
  "details": [
    { "field": "documents", "message": "documents must be a non-empty array" }
  ]
}
```

**Error Response (422):**
```json
{
  "error": "document_extraction_failed",
  "details": {
    "fileName": "discharge_summary.pdf",
    "reason": "ocr_backend_unreachable",
    "metadata": { ... }
  }
}
```

**Error Response (500):**
```json
{
  "error": "conversion_failed"
}
```

---

### Get Job Status

**GET** `/v1/claims/convert/{jobId}`

Get the status of a conversion job.

**Response (200):**
```json
{
  "jobId": "uuid-1234-5678",
  "status": "completed",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T10:30:05.000Z",
  "output": { ... }
}
```

**Response (404):**
```json
{
  "error": "job_not_found",
  "jobId": "uuid-1234-5678"
}
```

## Document Object

| Field | Type | Description |
|-------|------|-------------|
| `fileName` | string | Original file name (required) |
| `filePath` | string | Path to file on server |
| `base64Pdf` | string | Base64-encoded PDF content |
| `imageBase64` | string | Base64-encoded image content |
| `text` | string | Pre-extracted text (optional) |
| `hasTextLayer` | boolean | Whether PDF has text layer |

## Supported Document Types

- **discharge_summary**: Hospital discharge summary
- **diagnostic_report**: Lab reports, diagnostic test results
- **lab_report**: Laboratory test results
- **prescription**: Prescription documents
- **invoice**: Medical invoices
- **claim_form**: Claim forms
