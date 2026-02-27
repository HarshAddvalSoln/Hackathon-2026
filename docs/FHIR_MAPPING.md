# FHIR Mapping Documentation

## Overview

This document describes how extracted clinical data is mapped to NHCX-compliant FHIR R4 resources.

## FHIR Profile

All generated bundles conform to the NHCX-ClaimBundle profile:
```
https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle
```

## Resource Mapping

### Patient Resource

| Extracted Field | FHIR Field | Notes |
|----------------|-------------|-------|
| `patientName` | `name[0].text` | Patient full name |
| `patientLocalId` | `identifier[0].value` | Local patient ID |
| `patientGender` | `gender` | male/female/other/unknown |
| `patientDob` / `dateOfBirth` | `birthDate` | YYYY-MM-DD format |
| `patientAddress` | `address[0].text` | Patient address |
| `patientPincode` | `address[0].postalCode` | 6-digit PIN code |

Inferred fields are marked with extension: `inferred-demographics`

---

### Encounter Resource

| Extracted Field | FHIR Field | Notes |
|----------------|-------------|-------|
| `admissionDate` | `period.start` | Admission date |
| `dischargeDate` | `period.end` | Discharge date |
| `encounterType` | `class.code` | IMP (inpatient) or EMER (emergency) |
| `admissionReason` / `finalDiagnosis` | `reasonCode[0].text` | Primary diagnosis |
| `hospitalName` | `serviceProvider` reference | Treating facility |

---

### DiagnosticReport Resource (for diagnostic_report type)

| Extracted Field | FHIR Field | Notes |
|----------------|-------------|-------|
| `testName` | `code.text` | Test name |
| `observationDate` / `testDate` | `effectiveDateTime` | Test date |
| `resultValue` | `conclusion` | Test result |
| `interpretation` | `interpretation[0].text` | Result interpretation |
| `observations[]` | `result[]` references | Individual observations |

---

### Observation Resources

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `name` | `code.text` | Test/measurement name |
| `value` | `valueQuantity.value` or `valueString` | Numeric or text result |
| `unit` | `valueQuantity.unit` | Unit of measurement |
| `referenceRangeLow` | `referenceRange[0].low` | Lower reference limit |
| `referenceRangeHigh` | `referenceRange[0].high` | Upper reference limit |

---

### Composition Resource (for discharge_summary type)

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `finalDiagnosis` | `section[0].entry` → Condition | Primary diagnosis |
| `procedureDone` | `section[1]` | Procedures performed |
| `medications` | `section[2]` | Medications at discharge |

---

### Coverage Resource

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `payerName` / `insuranceCompany` | `payor[0].text` | Insurance provider |
| `policyNumber` / `policyNo` | `identifier[0].value` | Policy number |
| `memberId` / `patientPolicyId` | `subscriberId` | Member ID |
| `coverageStatus` | `status` | active/cancelled |

---

### DocumentReference Resource

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `fileName` | `description` | Document description |
| `sha256` | `identifier[0].value` | Document hash |
| `base64Pdf` | `content[0].attachment.data` | Document content |

---

### Organization Resource

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `hospitalName` / `facilityName` | `name` | Hospital name |
| `hospitalId` / `facilityId` | `identifier[0].value` | Hospital ID |
| `hospitalAddress` | `address[0].text` | Hospital address |

---

### Practitioner Resource

| Extracted Field | FHIR Field | Notes |
|----------------|------------|-------|
| `attendingPhysician` / `doctorName` | `name[0].text` | Physician name |
| `physicianRegNo` / `registrationNumber` | `identifier[0].value` | Registration number |

---

## HI Types

The system supports two primary document types:

1. **discharge_summary**
   - Creates: Patient, Encounter, Condition, Composition, Coverage, DocumentReference
   - LOINC Code: 34117-2 (Discharge summary)

2. **diagnostic_report**
   - Creates: Patient, Encounter, DiagnosticReport, Observation[], Coverage, DocumentReference
   - LOINC Code: 11502-2 (Laboratory report)

## Bundle Structure

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "identifier": {
    "system": "https://example-hsp.local/claim",
    "value": "CLM-2024-001"
  },
  "meta": {
    "profile": ["https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle"]
  },
  "entry": [
    { "resource": { "resourceType": "Patient", ... } },
    { "resource": { "resourceType": "Organization", ... } },
    { "resource": { "resourceType": "Practitioner", ... } },
    { "resource": { "resourceType": "Encounter", ... } },
    { "resource": { "resourceType": "DiagnosticReport", ... } },
    { "resource": { "resourceType": "Observation", ... } },
    { "resource": { "resourceType": "Coverage", ... } },
    { "resource": { "resourceType": "DocumentReference", ... } }
  ]
}
```
