function checkIdentifierPolicy(bundles) {
  const allPatientsHaveIdentifier = bundles.every((bundle) => {
    const patient = bundle.entry
      .map((entry) => entry.resource)
      .find((resource) => resource.resourceType === "Patient");
    const value = patient?.identifier?.[0]?.value;
    return Boolean(value && value !== "UNKNOWN");
  });

  return {
    ruleId: "NRCES-ID-01",
    title: "Patient identifier policy",
    status: allPatientsHaveIdentifier ? "pass" : "fail"
  };
}

function checkAuditPolicy(auditLog) {
  const requiredActions = ["convert_started", "bundle_generated", "result_viewed"];
  const actions = new Set((auditLog || []).map((item) => item.action));
  const allPresent = requiredActions.every((action) => actions.has(action));

  return {
    ruleId: "NRCES-AUDIT-01",
    title: "Audit trail for core actions",
    status: allPresent ? "pass" : "fail"
  };
}

function checkSourceTraceability(bundles) {
  const hasSourceHash = bundles.every((bundle) => {
    const docRef = bundle.entry
      .map((entry) => entry.resource)
      .find((resource) => resource.resourceType === "DocumentReference");
    return Boolean(docRef?.identifier?.[0]?.value);
  });

  return {
    ruleId: "NRCES-IMM-01",
    title: "Immutable source traceability",
    status: hasSourceHash ? "pass" : "fail"
  };
}

export function evaluateCompliance({ bundles = [], auditLog = [] }) {
  const checks = [
    checkIdentifierPolicy(bundles),
    checkAuditPolicy(auditLog),
    checkSourceTraceability(bundles)
  ];

  const overallStatus = checks.every((check) => check.status === "pass")
    ? "pass"
    : "fail";

  return {
    overallStatus,
    checks
  };
}
