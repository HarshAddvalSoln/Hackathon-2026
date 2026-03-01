/**
 * Date parsing and normalization utilities
 * Handles multiple input formats and converts to FHIR-compliant ISO dates
 */

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function isValidDate(year, month, day) {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

export function toFhirDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const trimmed = dateStr.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if (isValidDate(year, month, day)) {
      return trimmed;
    }
  }

  const ddMmYyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddMmYyyyMatch) {
    const [, first, second, year] = ddMmYyyyMatch;
    let day, month;
    if (parseInt(first, 10) > 12) {
      day = parseInt(first, 10);
      month = parseInt(second, 10);
    } else {
      day = parseInt(first, 10);
      month = parseInt(second, 10);
    }
    if (isValidDate(parseInt(year, 10), month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const yyyyMmDdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch.map(Number);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const textualMatch = trimmed.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+(\d{4})$/i);
  if (textualMatch) {
    const [, day, monthStr, year] = textualMatch;
    const month = MONTH_MAP[monthStr.toLowerCase()];
    if (month !== undefined && isValidDate(parseInt(year, 10), month + 1, parseInt(day, 10))) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const mmDdYyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (mmDdYyyyMatch) {
    const [, month, day, year] = mmDdYyyyMatch.map(Number);
    if (isValidDate(parseInt(year, 10), month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

export function toFhirDateTime(dateTimeStr) {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return null;
  }

  const trimmed = dateTimeStr.trim();
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?))?$/);
  if (isoMatch) {
    const [, date, time] = isoMatch;
    if (time) {
      return trimmed;
    }
    return `${date}T00:00:00.000Z`;
  }

  const date = toFhirDate(trimmed.split(' ')[0]);
  if (date) {
    return `${date}T00:00:00.000Z`;
  }

  return null;
}

export function getCurrentFhirDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function getCurrentFhirDateTime() {
  return new Date().toISOString();
}
