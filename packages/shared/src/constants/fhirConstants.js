/**
 * FHIR-related constants and code systems
 */

const FHIR = {
  // Base URLs
  BASE_URL: 'http://hl7.org/fhir',

  // NHCX Profile URLs
  CLAIM_BUNDLE_URL: 'http://localhost:3000/StructureDefinition/NHCX-ClaimBundle',
  CLAIM_URL: 'http://localhost:3000/StructureDefinition/NHCX-Claim',
  CLAIM_ITEM_URL: 'http://localhost:3000/StructureDefinition/NHCX-ClaimItem',

  // Resource Types
  RESOURCE_TYPES: {
    BUNDLE: 'Bundle',
    CLAIM: 'Claim',
    PATIENT: 'Patient',
    ENCOUNTER: 'Encounter',
    OBSERVATION: 'Observation',
    DIAGNOSTIC_REPORT: 'DiagnosticReport',
    COMPOSITION: 'Composition',
    ORGANIZATION: 'Organization',
    PRACTITIONER: 'Practitioner',
    CONDITION: 'Condition',
    PROCEDURE: 'Procedure',
    MEDICATION_REQUEST: 'MedicationRequest',
    ALLERGY_INTOLERANCE: 'AllergyIntolerance',
  },

  // Coding Systems
  CODING_SYSTEMS: {
    LOINC: 'http://loinc.org',
    SNOMED: 'http://snomed.info/sct',
    ICD10: 'http://hl7.org/fhir/sid/icd-10',
    ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
    NHCX: 'http://localhost:3000/CodeSystem/NHCX',
    IDENTIFIER_TYPE: 'http://terminology.hl7.org/CodeSystem/v2-0203',
    DOC_TYPE: 'http://localhost:3000/CodeSystem/document-type',
  },

  // Document Types
  DOCUMENT_TYPES: {
    DISCHARGE_SUMMARY: 'discharge_summary',
    DIAGNOSTIC_REPORT: 'diagnostic_report',
    LAB_REPORT: 'lab_report',
    PRESCRIPTION: 'prescription',
    INVOICE: 'invoice',
    CLAIM_FORM: 'claim_form',
    OTHER: 'other',
  },

  // Identifier Types
  IDENTIFIER_TYPES: {
    MR: 'MR',
    NH: 'NH',
    AN: 'AN',
    RN: 'RN',
  },

  // Claim Status
  CLAIM_STATUS: {
    ACTIVE: 'active',
    CANCELLED: 'cancelled',
    DRAFT: 'draft',
    ENTERED_IN_ERROR: 'entered-in-error',
  },

  // Claim Use
  CLAIM_USE: {
    COMPLETE: 'complete',
    PROPOSED: 'proposed',
    EXPLORATORY: 'exploratory',
    OTHER: 'other',
  },

  // Observation Categories
  OBSERVATION_CATEGORIES: {
    VITAL_SIGN: 'vital-signs',
    LABORATORY: 'laboratory',
    IMAGING: 'imaging',
    THERAPY: 'therapy',
    ACTIVITY: 'activity',
    SURVEY: 'survey',
    EXAM: 'exam',
    THERAPY: 'therapy',
    ACTIVITY: 'activity',
  },

  // Common LOINC Codes
  LOINC_CODES: {
    BODY_TEMPERATURE: '8310-5',
    HEART_RATE: '8867-4',
    RESPIRATORY_RATE: '9279-1',
    BLOOD_PRESSURE_SYSTOLIC: '8480-6',
    BLOOD_PRESSURE_DIASTOLIC: '8462-4',
    BODY_WEIGHT: '29463-7',
    BODY_HEIGHT: '8302-2',
    BMI: '39156-5',
    BLOOD_GLUCOSE: '2339-0',
    HEMOGLOBIN: '718-7',
    CREATININE: '2160-0',
  },

  // Gender
  GENDER: {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
    UNKNOWN: 'unknown',
  },

  // Administrative Gender
  ADMINISTRATIVE_GENDER: {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
    UNKNOWN: 'unknown',
  },

  // Name Use
  NAME_USE: {
    OFFICIAL: 'official',
    USUAL: 'usual',
    TEMP: 'temp',
    NICKNAME: 'nickname',
    ANONYMOUS: 'anonymous',
    OLD: 'old',
    MAIDEN: 'maiden',
  },

  // Address Use
  ADDRESS_USE: {
    HOME: 'home',
    WORK: 'work',
    TEMP: 'temp',
    OLD: 'old',
    BILLING: 'billing',
  },

  // Telecom Use
  TELECOM_USE: {
    HOME: 'home',
    WORK: 'work',
    TEMP: 'temp',
    MOBILE: 'mobile',
    OLD: 'old',
  },

  // Telecom System
  TELECOM_SYSTEM: {
    PHONE: 'phone',
    FAX: 'fax',
    EMAIL: 'email',
    URL: 'url',
    SMS: 'sms',
    OTHER: 'other',
  },
};

/**
 * Map document type to FHIR profile
 * @param {string} docType - Document type
 * @returns {string} FHIR profile URL
 */
function getProfileForDocumentType(docType) {
  const profileMap = {
    [FHIR.DOCUMENT_TYPES.DISCHARGE_SUMMARY]: 'http://localhost:3000/StructureDefinition/NHCX-DischargeSummary',
    [FHIR.DOCUMENT_TYPES.DIAGNOSTIC_REPORT]: 'http://localhost:3000/StructureDefinition/NHCX-DiagnosticReport',
    [FHIR.DOCUMENT_TYPES.LAB_REPORT]: 'http://localhost:3000/StructureDefinition/NHCX-LabReport',
    [FHIR.DOCUMENT_TYPES.PRESCRIPTION]: 'http://localhost:3000/StructureDefinition/NHCX-Prescription',
  };
  return profileMap[docType] || FHIR.CLAIM_BUNDLE_URL;
}

export {
  FHIR,
  getProfileForDocumentType,
};
