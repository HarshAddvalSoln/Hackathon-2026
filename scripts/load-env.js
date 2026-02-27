import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripWrappingQuotes(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvContent(content) {
  const entries = [];
  const lines = String(content || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, equalIndex).trim();
    const rawValue = trimmed.slice(equalIndex + 1);
    if (!key) {
      continue;
    }
    entries.push([key, stripWrappingQuotes(rawValue)]);
  }
  return entries;
}

function findEnvPath(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  while (true) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function loadDotEnv({ cwd } = {}) {
  const envPath = findEnvPath(cwd || process.cwd());
  if (!envPath) {
    return null;
  }
  const raw = readFileSync(envPath, "utf8");
  const pairs = parseEnvContent(raw);
  for (const [key, value] of pairs) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return envPath;
}
