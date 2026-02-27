function normalize(input) {
  return (input || "").toLowerCase();
}

function scoreHints(text, hints) {
  let score = 0;
  for (const hint of hints) {
    if (hint.pattern.test(text)) {
      score += hint.weight;
    }
  }
  return score;
}

export function detectHiType(text) {
  const t = normalize(text);
  const hasDischargeTitle =
    /\bdischarge\s*(summary|card|note|advice)\b/i.test(t) ||
    /\bclinical\s*summary\b/i.test(t);
  const hasDiagnosticTitle =
    /\bdiagnostic\s*report\b/i.test(t) ||
    /\b(?:laboratory|lab)\s*report\b/i.test(t) ||
    /\binvestigation\s*report\b/i.test(t) ||
    /\bpathology\s*report\b/i.test(t) ||
    /\becho\s*cardio(?:graphy|gram)\s*report\b/i.test(t);

  if (hasDischargeTitle && !hasDiagnosticTitle) {
    return "discharge_summary";
  }
  if (hasDiagnosticTitle && !hasDischargeTitle) {
    return "diagnostic_report";
  }
  if (hasDischargeTitle && hasDiagnosticTitle) {
    return "discharge_summary";
  }

  const dischargeHints = [
    { pattern: /\bdischarge\s*(summary|card|note|advice)\b/i, weight: 3 },
    { pattern: /\bdate\s*of\s*discharge\b/i, weight: 2 },
    { pattern: /\bdate\s*of\s*admission\b/i, weight: 2 },
    { pattern: /\badmission\s*date\b/i, weight: 2 },
    { pattern: /\bfinal\s*diagnosis\b/i, weight: 2 },
    { pattern: /\bdiagnosis\s*at\s*discharge\b/i, weight: 2 },
    { pattern: /\bcondition\s*at\s*discharge\b/i, weight: 2 },
    { pattern: /\bhospital\s*course\b/i, weight: 2 },
    { pattern: /\bchief\s*complaints?\b/i, weight: 1 },
    { pattern: /\bmedications?\s*on\s*discharge\b/i, weight: 2 }
  ];
  const diagnosticHints = [
    { pattern: /\bdiagnostic\s*report\b/i, weight: 3 },
    { pattern: /\b(?:laboratory|lab)\s*report\b/i, weight: 3 },
    { pattern: /\binvestigation\s*report\b/i, weight: 2 },
    { pattern: /\btest\s*name\b/i, weight: 2 },
    { pattern: /\breference\s*(?:range|interval)\b/i, weight: 2 },
    { pattern: /\bobservation\s*date\b/i, weight: 1 },
    { pattern: /\binvestigation\s*result\b/i, weight: 2 },
    { pattern: /\bparameter\s+result\s+unit\b/i, weight: 3 },
    { pattern: /\b(?:biochemistry|hematology|haematology|microbiology)\b/i, weight: 2 },
    { pattern: /\b(?:renal|liver|thyroid)\s*function\s*test\b/i, weight: 2 },
    { pattern: /\b(?:cbc|complete\s*blood\s*count)\b/i, weight: 2 },
    { pattern: /\bspecimen\b/i, weight: 1 },
    { pattern: /\becho\s*cardio(?:graphy|gram)\b/i, weight: 3 },
    { pattern: /\bcolour\s*doppler\b/i, weight: 2 },
    { pattern: /\blvef\b/i, weight: 2 },
    { pattern: /\bdiastolic\s*dysfunction\b/i, weight: 1 }
  ];

  const dischargeScore = scoreHints(t, dischargeHints);
  const diagnosticScore = scoreHints(t, diagnosticHints);

  const hasLabResultShape =
    /\b(?:mg\/dl|g\/dl|iu\/l|mmol\/l|ng\/ml|cells\/cumm|%|pg\/ml)\b/i.test(t) &&
    /\breference\s*(?:range|interval)|investigation|result\b/i.test(t);
  const diagnosticBoostedScore = diagnosticScore + (hasLabResultShape ? 2 : 0);

  if (dischargeScore > diagnosticBoostedScore && dischargeScore > 0) {
    return "discharge_summary";
  }
  if (diagnosticBoostedScore > dischargeScore && diagnosticBoostedScore > 0) {
    return "diagnostic_report";
  }
  if (dischargeScore > 0 && diagnosticBoostedScore > 0) {
    // Keep existing deterministic preference for discharge when scores tie.
    return "discharge_summary";
  }
  return "unknown";
}
