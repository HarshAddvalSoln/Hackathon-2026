import { getConfig } from "../../config/src/index.js";

export function evaluateDocumentQuality({ hiType, extracted, template }) {
  const config = getConfig();
  if (hiType === "unknown") {
    return {
      hiType,
      status: "warning",
      missingRequiredFields: ["hiTypeDetection"],
      confidenceScore: 0,
      lowConfidence: true
    };
  }

  const requiredFields = template?.quality?.[hiType]?.requiredFields || [];
  const missingRequiredFields = requiredFields.filter((field) => {
    if (hiType === "diagnostic_report" && (field === "testName" || field === "resultValue")) {
      const hasObservationArray = Array.isArray(extracted?.observations) && extracted.observations.length > 0;
      if (hasObservationArray) {
        return false;
      }
    }
    const value = extracted?.[field];
    return value === null || value === undefined || value === "";
  });
  const presentRequiredCount = requiredFields.length - missingRequiredFields.length;
  const confidenceScore =
    requiredFields.length === 0
      ? 1
      : Number((presentRequiredCount / requiredFields.length).toFixed(2));

  return {
    hiType,
    status: missingRequiredFields.length === 0 ? "pass" : "warning",
    missingRequiredFields,
    confidenceScore,
    lowConfidence: confidenceScore < config.lowConfidenceThreshold
  };
}
