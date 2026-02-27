import { useMemo, useState } from "react";

const TAB_KEYS = {
  OVERVIEW: "overview",
  EXTRACTION: "extraction",
  FHIR: "fhir",
  TRACE: "trace"
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pass" || normalized === "completed") {
    return "status status-pass";
  }
  if (normalized === "warning" || normalized === "warn") {
    return "status status-warning";
  }
  if (normalized === "fail" || normalized === "failed") {
    return "status status-fail";
  }
  return "status status-neutral";
}

function renderValue(value) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : JSON.stringify(value);
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function getBundleResourceSummary(bundle) {
  const entries = Array.isArray(bundle?.entry) ? bundle.entry : [];
  const counts = {};
  for (const entry of entries) {
    const resourceType = entry?.resource?.resourceType || "Unknown";
    counts[resourceType] = (counts[resourceType] || 0) + 1;
  }
  return counts;
}

function getOutcomeIssues(output) {
  const issues = [];

  const firstValidationError = output?.validationReport?.bundleReports
    ?.flatMap((item) => item?.errors || [])
    ?.find(Boolean);
  if (firstValidationError) {
    issues.push({
      title: "Validation",
      message: firstValidationError.message,
      path: firstValidationError.path || "unknown"
    });
  }

  const extractionReports = Array.isArray(output?.extractionReports) ? output.extractionReports : [];
  for (const report of extractionReports) {
    const diagnostics = collectDiagnosticErrors(report?.extractionDiagnostics);
    const rootDiagnostic = diagnostics.find(Boolean);
    if (rootDiagnostic) {
      issues.push({
        title: `Extraction (${report.fileName || "document"})`,
        message: rootDiagnostic.message || "Extraction error",
        path: rootDiagnostic.stage || "diagnostics"
      });
      break;
    }
    if (
      String(report?.status || "").toLowerCase() === "fail"
      && Array.isArray(report?.missingRequiredFields)
      && report.missingRequiredFields.length > 0
    ) {
      issues.push({
        title: `Missing fields (${report.fileName || "document"})`,
        message: report.missingRequiredFields.join(", "),
        path: "quality"
      });
      break;
    }
  }

  return issues.slice(0, 3);
}

function DocumentDropzone({
  files,
  dragging,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave
}) {
  return (
    <label
      className={`dropzone ${dragging ? "dropzone-active" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        className="dropzone-input"
        type="file"
        accept=".pdf,application/pdf"
        multiple
        onChange={onFileChange}
      />
      <div className="dropzone-title">Drop clinical PDFs here</div>
      <div className="dropzone-subtitle">or click to browse files</div>
      <div className="dropzone-hint">Supports digital PDFs and scanned image PDFs via OCR.</div>
      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              <span>{file.name}</span>
              <span>{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

function OverviewTab({ output }) {
  const bundle = output?.bundles?.[0];
  const summary = getBundleResourceSummary(bundle);
  const issues = getOutcomeIssues(output);

  return (
    <div className="panel-grid">
      <section className="panel">
        <h3>Conversion Outcome</h3>
        <div className="metric-grid">
          <article>
            <div className="metric-label">Claim ID</div>
            <div className="metric-value">{output?.claimId || "N/A"}</div>
          </article>
          <article>
            <div className="metric-label">Template</div>
            <div className="metric-value">default</div>
          </article>
          <article>
            <div className="metric-label">Validation</div>
            <div className={statusClass(output?.validationReport?.status)}>
              {output?.validationReport?.status || "unknown"}
            </div>
          </article>
          <article>
            <div className="metric-label">Compliance</div>
            <div className={statusClass(output?.complianceReport?.overallStatus)}>
              {output?.complianceReport?.overallStatus || "unknown"}
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <h3>Detected HI Types</h3>
        <div className="tag-wrap">
          {(output?.classifications || []).map((item) => (
            <span key={`${item.fileName}-${item.hiType}`} className="tag">
              {item.fileName}
              {" -> "}
              {item.hiType}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Bundle Resource Mix</h3>
        <div className="resource-grid">
          {Object.keys(summary).length === 0 ? (
            <div className="muted">No bundle resources available.</div>
          ) : (
            Object.entries(summary).map(([name, count]) => (
              <article key={name} className="resource-item">
                <span>{name}</span>
                <strong>{count}</strong>
              </article>
            ))
          )}
        </div>
      </section>

      {issues.length > 0 ? (
        <section className="panel">
          <h3>Why It Failed</h3>
          <ul className="issue-list">
            {issues.map((issue, index) => (
              <li key={`${issue.title}-${index}`}>
                <strong>{issue.title}</strong>
                <span>{issue.message}</span>
                <em>{issue.path}</em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function collectDiagnosticErrors(extractionDiagnostics) {
  if (!extractionDiagnostics || typeof extractionDiagnostics !== "object") {
    return [];
  }

  const directErrors = extractionDiagnostics?.diagnostics?.errors;
  if (Array.isArray(directErrors) && directErrors.length > 0) {
    return directErrors;
  }

  const attempts = Array.isArray(extractionDiagnostics?.attempts)
    ? extractionDiagnostics.attempts
    : [];
  const attemptErrors = [];
  for (const attempt of attempts) {
    const errors = attempt?.diagnostics?.errors;
    if (!Array.isArray(errors) || errors.length === 0) {
      continue;
    }
    for (const error of errors) {
      attemptErrors.push({
        mode: attempt.mode,
        ...error
      });
    }
  }

  return attemptErrors;
}

function ExtractionTab({ output }) {
  const reports = output?.extractionReports || [];
  return (
    <div className="stack">
      {reports.map((report, reportIndex) => {
        const extracted = report?.extracted || {};
        const scalarKeys = Object.keys(extracted).filter((key) => key !== "observations");
        const observations = Array.isArray(extracted.observations) ? extracted.observations : [];
        const diagnostics = collectDiagnosticErrors(report?.extractionDiagnostics);

        return (
          <section className="panel" key={`${report.fileName}-${reportIndex}`}>
            <div className="panel-header">
              <h3>{report.fileName}</h3>
              <div className="status-row">
                <span className="tag">{report.hiType}</span>
                <span className={statusClass(report.status)}>{report.status}</span>
                <span className="tag">confidence: {report.confidenceScore ?? 0}</span>
                <span className="tag">{report.sourceMode || "unknown-source"}</span>
              </div>
            </div>

            <div className="kv-grid">
              {scalarKeys.length === 0 ? <div className="muted">No direct fields extracted.</div> : null}
              {scalarKeys.map((key) => (
                <article className="kv-item" key={key}>
                  <span>{key}</span>
                  <strong>{renderValue(extracted[key])}</strong>
                </article>
              ))}
            </div>

            {observations.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Observation</th>
                      <th>Value</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {observations.map((obs, index) => (
                      <tr key={`${obs.name}-${index}`}>
                        <td>{obs.name || "N/A"}</td>
                        <td>{obs.value || "N/A"}</td>
                        <td>{obs.unit || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {diagnostics.length > 0 ? (
              <div className="diag-box">
                <h4>OCR Diagnostics</h4>
                <ul>
                  {diagnostics.map((diag, index) => (
                    <li key={`${diag.stage || "ocr"}-${index}`}>
                      <strong>{diag.stage || "error"}</strong>
                      <span>{diag.message || "Unknown OCR issue"}</span>
                      {diag.mode ? <em>source: {diag.mode}</em> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function FhirTab({ output }) {
  return (
    <div className="stack">
      {(output?.bundles || []).map((bundle, index) => (
        <section className="panel" key={`bundle-${index}`}>
          <h3>FHIR Bundle {index + 1}</h3>
          <pre>{JSON.stringify(bundle, null, 2)}</pre>
        </section>
      ))}
    </div>
  );
}

function TraceTab({ output }) {
  const validationErrors = output?.validationReport?.bundleReports?.flatMap((bundleReport, bundleIndex) =>
    (bundleReport?.errors || []).map((error, errorIndex) => ({
      id: `${bundleIndex}-${errorIndex}`,
      ...error
    }))
  );

  return (
    <div className="panel-grid">
      <section className="panel">
        <h3>Compliance Checks</h3>
        <ul className="line-list">
          {(output?.complianceReport?.checks || []).map((check) => (
            <li key={check.ruleId}>
              <span>{check.ruleId}</span>
              <span>{check.title}</span>
              <span className={statusClass(check.status)}>{check.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Validation Errors</h3>
        {validationErrors?.length ? (
          <ul className="line-list">
            {validationErrors.map((item) => (
              <li key={item.id}>
                <span>{item.code}</span>
                <span>{item.message}</span>
                <span className="muted">{item.path || "path-unavailable"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">No validation errors.</div>
        )}
      </section>

      <section className="panel">
        <h3>Audit Trail</h3>
        <ul className="line-list">
          {(output?.auditLog || []).map((event, index) => (
            <li key={`${event.action}-${index}`}>
              <span>{event.action}</span>
              <span>{event.actor}</span>
              <span>{event.timestamp}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FuturisticLoadingState() {
  return (
    <div className="ai-loader" role="status" aria-live="polite">
      <div className="ai-loader-head">
        <span className="ai-loader-chip">AI ORCHESTRATION ACTIVE</span>
        <strong>Converting Clinical Document to NHCX FHIR</strong>
      </div>
      <div className="ai-loader-visual">
        <div className="ai-core" />
        <div className="ai-ring ai-ring-one" />
        <div className="ai-ring ai-ring-two" />
        <div className="ai-ring ai-ring-three" />
        <div className="ai-scan-line" />
      </div>
      <ul className="ai-steps">
        <li>Running OCR and text normalization</li>
        <li>Classifying HI type (Diagnostic Report / Discharge Summary)</li>
        <li>Extracting clinical entities and observations</li>
        <li>Assembling FHIR resources and validation reports</li>
      </ul>
      <div className="ai-loader-bars">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function App() {
  const [files, setFiles] = useState([]);
  const [activeTab, setActiveTab] = useState(TAB_KEYS.OVERVIEW);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const tabs = useMemo(
    () => [
      { key: TAB_KEYS.OVERVIEW, label: "Outcome" },
      { key: TAB_KEYS.EXTRACTION, label: "Extracted Data" },
      { key: TAB_KEYS.FHIR, label: "FHIR JSON" },
      { key: TAB_KEYS.TRACE, label: "Validation & Audit" }
    ],
    []
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (files.length === 0) {
      setError("Upload at least one PDF document.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/v1/claims/convert", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "conversion_failed");
      }
      setResult(payload);
      setActiveTab(TAB_KEYS.OVERVIEW);
    } catch (requestError) {
      setError(requestError.message || "Unable to process uploaded files.");
    } finally {
      setBusy(false);
    }
  }

  function onInputChange(event) {
    const nextFiles = Array.from(event.target.files || []);
    setFiles(nextFiles);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files || []).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );
    if (dropped.length > 0) {
      setFiles(dropped);
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />

      <header className="hero">
        <p className="eyebrow">ABDM Hackathon - FHIR Utility for Providers</p>
        <h1>Clinical Documents to FHIR Structured Data Convertor</h1>
        <p>
          Upload discharge summaries or diagnostic PDFs, classify HI type, extract structured fields, and generate
          NHCX-aligned FHIR bundles with NRCeS validation diagnostics.
        </p>
      </header>

      <main className="content-grid">
        <section className="panel uploader-panel">
          <h2 style={{ padding: "1rem 0" }}>Upload Claim Documents</h2>
          <form onSubmit={handleSubmit} className="stack">
            <DocumentDropzone
              files={files}
              dragging={dragging}
              onFileChange={onInputChange}
              onDrop={onDrop}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
            />

            <button type="submit" disabled={busy} className="primary-btn">
              {busy ? "Converting..." : "Convert to FHIR Bundle"}
            </button>
            {error ? <div className="error-box">{error}</div> : null}
          </form>
        </section>

        <section className="panel result-panel">
          <div className="panel-header">
            <h2>Conversion Intelligence</h2>
            {result?.status ? <span className={statusClass(result.status)}>{result.status}</span> : null}
          </div>

          {busy ? (
            <FuturisticLoadingState />
          ) : !result?.output ? (
            <div className="empty-state">
              <strong>Ready for demo</strong>
              <p>Upload at least one PDF to view extraction quality, validation traces, and generated FHIR bundles.</p>
            </div>
          ) : (
            <>
              <div className="tab-row">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`tab-btn ${activeTab === tab.key ? "tab-btn-active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="tab-content">
                {activeTab === TAB_KEYS.OVERVIEW ? <OverviewTab output={result.output} /> : null}
                {activeTab === TAB_KEYS.EXTRACTION ? <ExtractionTab output={result.output} /> : null}
                {activeTab === TAB_KEYS.FHIR ? <FhirTab output={result.output} /> : null}
                {activeTab === TAB_KEYS.TRACE ? <TraceTab output={result.output} /> : null}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
