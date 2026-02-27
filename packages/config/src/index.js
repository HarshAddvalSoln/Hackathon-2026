const defaultTemplate = {
  id: "default",
  extractors: {
    discharge_summary: {
      patientName: ["Patient Name", "Patient's Name", "Pt Name", "PatientName"],
      patientLocalId: ["UHID", "UHID No", "Local ID", "IP No", "Hospital No", "Reg No"],
      admissionDate: ["Date of Admission", "Admission Date", "DOA"],
      dischargeDate: ["Date of Discharge", "Discharge Date", "DOD"],
      finalDiagnosis: ["Final Diagnosis", "Diagnosis at Discharge", "Provisional Diagnosis"]
    },
    diagnostic_report: {
      patientName: ["Patient Name", "PatientName", "Patient's Name", "Pt Name"],
      patientLocalId: ["UHID", "UHID No", "Local ID", "Patient ID", "PatientID", "Patient|D", "Reg No", "Lab No"],
      testName: ["Test Name", "Investigation", "Investigation Name", "Test"],
      resultValue: ["Result", "Test Result", "Observed Value", "Value"],
      observationDate: ["Observation Date", "Report Date", "Sample Date", "Collected On", "Reported On"]
    }
  },
  quality: {
    discharge_summary: {
      requiredFields: ["patientName", "patientLocalId", "finalDiagnosis"]
    },
    diagnostic_report: {
      requiredFields: ["patientName", "patientLocalId", "testName", "resultValue"]
    }
  }
};

// Configuration constants
const config = {
  // Concurrency settings
  documentConcurrency: 2,

  // Observation limits
  maxObservationsPerReport: 25,

  // Quality thresholds
  lowConfidenceThreshold: 0.7,

  // LLM enrichment settings
  llmEnrichmentMinTextLength: 1,

  // Supported hiTypes
  supportedHiTypes: ["discharge_summary", "diagnostic_report"]
};

// Shared token sets for name/ID normalization (used across packages)
export const SHARED_TOKENS = {
  TITLE_TOKENS: new Set(["mr", "mrs", "ms", "miss", "dr", "shri", "smt", "kumari", "baby", "master"]),
  INVALID_TOKENS: new Set(["unknown", "na", "n/a", "null", "undefined", "age", "gender", "id", "name"]),
  INVALID_NAME_TOKENS: new Set(["age", "gender", "male", "female", "unknown", "na", "n/a", "patient", "id", "uhid"]),
  INVALID_ID_TOKENS: new Set(["age", "gender", "male", "female", "unknown", "na", "n/a", "patient", "name", "id"])
};

export function getConfig() {
  return config;
}

export function getHospitalTemplate() {
  return defaultTemplate;
}
