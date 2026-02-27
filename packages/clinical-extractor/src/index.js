function pick(text, regex) {
  const match = regex.exec(text);
  return match?.[1]?.trim() || null;
}

function collectMatches(text, regex) {
  const values = [];
  for (const match of text.matchAll(regex)) {
    if (typeof match?.[1] === "string") {
      values.push(match[1].trim());
    }
  }
  return values;
}

function buildLabelRegex(labels, flags = "i") {
  const alternatives = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`(?:${alternatives})\\s*(?::|\\||\\+|=|-)?\\s*([^\\n\\r]+)`, flags);
}

function collectLabelValues(text, labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return [];
  }
  return collectMatches(text, buildLabelRegex(labels, "gi"));
}

function extractDate(text, labels) {
  const alternatives = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(
    `(?:${alternatives})\\s*(?::|\\||\\+|=|-)?\\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}-[0-9]{2}-[0-9]{4}|[0-9]{2}/[0-9]{2}/[0-9]{4})`,
    "i"
  );
  return pick(text, regex);
}

function cleanInlineValue(value) {
  if (!value) {
    return null;
  }
  return value
    .replace(/\s{2,}/g, " ")
    .replace(
      /\b(?:Patient\s*(?:ID|\|D)|UHID|Age|Gender|Sample\s*Date|Report\s*Date|Ref\.?\s*Doctor|Collected\s*On)\b.*$/i,
      ""
    )
    .trim();
}

const TITLE_TOKENS = new Set(["mr", "mrs", "ms", "miss", "dr", "shri", "smt", "kumari", "baby", "master"]);
const INVALID_NAME_TOKENS = new Set([
  "age",
  "gender",
  "male",
  "female",
  "unknown",
  "na",
  "n/a",
  "patient",
  "id",
  "uhid"
]);
const INVALID_ID_TOKENS = new Set([
  "age",
  "gender",
  "male",
  "female",
  "unknown",
  "na",
  "n/a",
  "patient",
  "name",
  "id"
]);
const NON_CLINICAL_OBSERVATION_NAME_PATTERN =
  /\b(?:regn|registration|doctor|consultant|mobile|phone|address|email|ref\.?\s*doctor|fax|contact)\b/i;
const NON_CLINICAL_RESULT_PATTERN =
  /\b(?:regn|registration|doctor|consultant|mobile|phone|address|email|fax|contact)\b/i;

function normalizeNameCandidate(value) {
  const cleaned = cleanInlineValue(value)?.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.\s-]+$/g, "").trim();
  if (!cleaned) {
    return null;
  }

  if (/\d/.test(cleaned)) {
    return null;
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  if (tokens.every((token) => INVALID_NAME_TOKENS.has(token.toLowerCase()))) {
    return null;
  }

  const nonTitleAlphaTokens = tokens.filter(
    (token) => /[A-Za-z]/.test(token) && !TITLE_TOKENS.has(token.toLowerCase())
  );
  if (!nonTitleAlphaTokens.some((token) => token.length >= 2)) {
    return null;
  }

  return cleaned;
}

function scoreNameCandidate(value) {
  const tokens = value.split(/\s+/).filter(Boolean);
  const nonTitleCount = tokens.filter((token) => !TITLE_TOKENS.has(token.toLowerCase())).length;
  let score = nonTitleCount;
  if (value.length >= 6) {
    score += 1;
  }
  return score;
}

function normalizePatientIdCandidate(value) {
  const cleaned = cleanInlineValue(value)?.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9/_-]+$/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9/_-]+$/g, "").trim())
    .filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (INVALID_ID_TOKENS.has(lower)) {
      continue;
    }
    if (!/\d/.test(token)) {
      continue;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(token) || /^\d{4}-\d{2}-\d{2}$/.test(token)) {
      continue;
    }
    if (!/^[A-Za-z0-9/_-]+$/.test(token)) {
      continue;
    }
    return token;
  }
  return null;
}

function scorePatientIdCandidate(value) {
  let score = value.length >= 4 ? 1 : 0;
  if (/[A-Za-z]/.test(value)) {
    score += 1;
  }
  if (/[/-]/.test(value)) {
    score += 1;
  }
  return score;
}

function selectBestCandidate(candidates, normalize, score) {
  let bestValue = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (!normalized) {
      continue;
    }
    const nextScore = score(normalized);
    if (nextScore > bestScore) {
      bestScore = nextScore;
      bestValue = normalized;
    }
  }

  return bestValue;
}

function isLikelyClinicalObservationName(name) {
  if (!name) {
    return false;
  }
  if (NON_CLINICAL_OBSERVATION_NAME_PATTERN.test(name)) {
    return false;
  }
  if (!/[A-Za-z]{2,}/.test(name)) {
    return false;
  }
  return true;
}

function isLikelyClinicalUnit(unit) {
  const normalized = String(unit || "").trim();
  if (!normalized) {
    return false;
  }
  const compact = normalized.toLowerCase();
  if (compact === "ph" || compact === "no") {
    return false;
  }
  if (compact.length <= 2 && !["pg", "fl", "%", "iu", "ng", "mm"].includes(compact)) {
    return false;
  }
  return /[a-z%]/i.test(compact);
}

function sanitizeDiagnosticTestName(value) {
  const cleaned = cleanInlineValue(value);
  if (!cleaned) {
    return null;
  }
  if (NON_CLINICAL_OBSERVATION_NAME_PATTERN.test(cleaned)) {
    return null;
  }
  if (!/[A-Za-z]{2,}/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function sanitizeDiagnosticResultValue(value) {
  const cleaned = cleanInlineValue(value);
  if (!cleaned) {
    return null;
  }
  if (NON_CLINICAL_RESULT_PATTERN.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function parseDiagnosticObservations(text) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const observations = [];
  const headerPattern =
    /^(parameter|investigation|result|unit|biological|reference|comments|end of report|patientname|patient id|age|gender)\b/i;

  for (const line of lines) {
    if (headerPattern.test(line)) {
      continue;
    }

    const match = /^([A-Za-z][A-Za-z0-9()./%\s-]{1,50}?)\s+([<>]?-?\d+(?:[.,]\d+)?)\s+([A-Za-z0-9/%^][A-Za-z0-9/%^.-]*)\b/.exec(
      line
    );
    if (!match) {
      continue;
    }

    const name = match[1].trim().replace(/\s{2,}/g, " ");
    const value = match[2].replace(",", ".");
    const unit = match[3].trim();
    if (name.length < 2) {
      continue;
    }
    if (!isLikelyClinicalObservationName(name)) {
      continue;
    }
    if (!isLikelyClinicalUnit(unit)) {
      continue;
    }

    observations.push({
      name,
      value,
      unit,
      raw: line
    });
  }

  const unique = [];
  const seen = new Set();
  for (const obs of observations) {
    const key = `${obs.name.toLowerCase()}|${obs.value}|${obs.unit.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(obs);
  }
  return unique;
}

function extractDischargeSummary(text, config) {
  return {
    patientName: cleanInlineValue(pick(text, buildLabelRegex(config.patientName))),
    patientLocalId: cleanInlineValue(pick(text, buildLabelRegex(config.patientLocalId))),
    admissionDate: extractDate(text, config.admissionDate),
    dischargeDate: extractDate(text, config.dischargeDate),
    finalDiagnosis: pick(text, buildLabelRegex(config.finalDiagnosis))
  };
}

function extractDiagnosticReport(text, config) {
  const patientNameCandidates = [
    ...collectMatches(
      text,
      /Patient\s*Name\s*(?::|\||\+|=|-)?\s*([^\n\r]+?)(?=\s+(?:Patient\s*(?:ID|\|D)|UHID|Age|Gender|Sample\s*Date|Report\s*Date)|$)/gi
    ),
    ...collectMatches(
      text,
      /\bName\s*(?::|\||\+|=|-)?\s*([^\n\r]+?)(?=\s+(?:Patient\s*(?:ID|\|D)|UHID|Age|Gender|Sample\s*Date|Report\s*Date|DATE)|$)/gi
    ),
    ...collectLabelValues(text, config.patientName)
  ];
  const patientIdCandidates = [
    ...collectMatches(text, /Patient\s*(?:ID|\|D)\s*(?::|\||\+|=|-)?\s*([^\n\r]+)/gi),
    ...collectMatches(text, /\b(?:UHID|IP\s*No|Lab\s*No|Reg\s*No|Local\s*ID)\s*(?::|\||\+|=|-)?\s*([^\n\r]+)/gi),
    ...collectLabelValues(text, config.patientLocalId)
  ];

  const patientName = selectBestCandidate(patientNameCandidates, normalizeNameCandidate, scoreNameCandidate);
  const patientLocalId = selectBestCandidate(
    patientIdCandidates,
    normalizePatientIdCandidate,
    scorePatientIdCandidate
  );
  const observations = parseDiagnosticObservations(text);
  const firstObservation = observations[0];
  const explicitTestName = sanitizeDiagnosticTestName(pick(text, buildLabelRegex(config.testName)));
  const explicitResultValue = sanitizeDiagnosticResultValue(pick(text, buildLabelRegex(config.resultValue)));

  return {
    patientName,
    patientLocalId,
    testName: explicitTestName || firstObservation?.name || null,
    resultValue:
      explicitResultValue ||
      (firstObservation ? `${firstObservation.value} ${firstObservation.unit}` : null),
    observationDate: extractDate(text, config.observationDate),
    observations
  };
}

export function extractStructuredData({ hiType, text, template }) {
  const extractorConfig = template?.extractors?.[hiType];
  if (hiType === "discharge_summary") {
    return extractDischargeSummary(
      text,
      extractorConfig || {
        patientName: ["Patient Name"],
        patientLocalId: ["UHID", "Local ID"],
        admissionDate: ["Date of Admission"],
        dischargeDate: ["Date of Discharge"],
        finalDiagnosis: ["Final Diagnosis"]
      }
    );
  }
  if (hiType === "diagnostic_report") {
    return extractDiagnosticReport(
      text,
      extractorConfig || {
        patientName: ["Patient Name", "PatientName"],
        patientLocalId: ["UHID", "Local ID", "Patient ID", "PatientID", "Patient|D"],
        testName: ["Test Name", "Investigation"],
        resultValue: ["Result", "Test Result"],
        observationDate: ["Observation Date", "Report Date", "Sample Date"]
      }
    );
  }
  return {};
}
