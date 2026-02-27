const CLAIM_BUNDLE_PROFILE =
  "https://nhcx.abdm.gov.in/fhir/StructureDefinition/NHCX-ClaimBundle";

function getResource(bundle, resourceType) {
  return bundle.entry
    ?.map((entry) => entry.resource)
    .find((resource) => resource?.resourceType === resourceType);
}

function getResources(bundle, resourceType) {
  return (bundle.entry || [])
    .map((entry) => entry.resource)
    .filter((resource) => resource?.resourceType === resourceType);
}

function addError(errors, code, message, path) {
  errors.push({ code, message, path });
}

function collectResourceIds(bundle, errors) {
  const resources = (bundle.entry || []).map((entry) => entry.resource).filter(Boolean);
  const ids = new Set();
  for (const resource of resources) {
    if (!resource.id) {
      continue;
    }
    if (ids.has(resource.id)) {
      addError(
        errors,
        "DUPLICATE_RESOURCE_ID",
        `Duplicate resource id '${resource.id}' found in bundle`,
        "entry.resource.id"
      );
    }
    ids.add(resource.id);
  }
}

function validatePatientAndDocumentReference(bundle, errors) {
  const patient = getResource(bundle, "Patient");
  if (!patient) {
    addError(errors, "PATIENT_MISSING", "Patient resource is required", "entry[Patient]");
  } else {
    if (!patient.identifier?.[0]?.value || patient.identifier[0].value === "UNKNOWN") {
      addError(
        errors,
        "PATIENT_IDENTIFIER_MISSING",
        "Patient identifier value is required",
        "Patient.identifier[0].value"
      );
    }
    if (!Array.isArray(patient.name) || patient.name.length === 0 || !patient.name[0].text) {
      addError(errors, "PATIENT_NAME_MISSING", "Patient name is required", "Patient.name[0].text");
    }
  }

  const patientReference = patient?.id ? `Patient/${patient.id}` : null;
  const docRefs = getResources(bundle, "DocumentReference");
  if (docRefs.length === 0) {
    addError(
      errors,
      "DOCUMENT_REFERENCE_MISSING",
      "DocumentReference resource is required",
      "entry[DocumentReference]"
    );
    return;
  }

  for (let i = 0; i < docRefs.length; i += 1) {
    const docRef = docRefs[i];
    if (!docRef?.identifier?.[0]?.value) {
      addError(
        errors,
        "DOCUMENT_REFERENCE_SOURCE_MISSING",
        "DocumentReference source hash is required",
        `DocumentReference[${i}].identifier[0].value`
      );
    }
    if (patientReference && docRef?.subject?.reference !== patientReference) {
      addError(
        errors,
        "DOCUMENT_REFERENCE_SUBJECT_INVALID",
        "DocumentReference subject must reference the Patient resource",
        `DocumentReference[${i}].subject.reference`
      );
    }
  }
}

function validateDiagnosticResources(bundle, errors) {
  const patient = getResource(bundle, "Patient");
  const patientReference = patient?.id ? `Patient/${patient.id}` : null;
  const diagnosticReports = getResources(bundle, "DiagnosticReport");
  if (diagnosticReports.length === 0) {
    return;
  }

  const observations = getResources(bundle, "Observation");
  if (observations.length === 0) {
    addError(
      errors,
      "DIAGNOSTIC_OBSERVATION_MISSING",
      "DiagnosticReport requires at least one Observation",
      "entry[Observation]"
    );
  }

  const observationIds = new Set(observations.map((item) => item.id).filter(Boolean));

  for (let i = 0; i < diagnosticReports.length; i += 1) {
    const report = diagnosticReports[i];
    if (patientReference && report?.subject?.reference !== patientReference) {
      addError(
        errors,
        "DIAGNOSTIC_REPORT_SUBJECT_INVALID",
        "DiagnosticReport subject must reference the Patient resource",
        `DiagnosticReport[${i}].subject.reference`
      );
    }

    const resultRefs = Array.isArray(report?.result) ? report.result : [];
    if (resultRefs.length === 0) {
      addError(
        errors,
        "DIAGNOSTIC_REPORT_RESULT_MISSING",
        "DiagnosticReport.result must contain Observation references",
        `DiagnosticReport[${i}].result`
      );
    }

    for (let r = 0; r < resultRefs.length; r += 1) {
      const ref = resultRefs[r]?.reference || "";
      const id = ref.startsWith("Observation/") ? ref.split("/")[1] : "";
      if (!id || !observationIds.has(id)) {
        addError(
          errors,
          "DIAGNOSTIC_REPORT_RESULT_REFERENCE_INVALID",
          "DiagnosticReport.result references must point to existing Observation resources",
          `DiagnosticReport[${i}].result[${r}].reference`
        );
      }
    }
  }

  for (let i = 0; i < observations.length; i += 1) {
    const observation = observations[i];
    if (patientReference && observation?.subject?.reference !== patientReference) {
      addError(
        errors,
        "OBSERVATION_SUBJECT_INVALID",
        "Observation subject must reference the Patient resource",
        `Observation[${i}].subject.reference`
      );
    }
    const hasResultValue =
      typeof observation?.valueString === "string" ||
      typeof observation?.valueQuantity?.value === "number";
    if (!hasResultValue) {
      addError(
        errors,
        "OBSERVATION_VALUE_MISSING",
        "Observation must contain valueString or valueQuantity.value",
        `Observation[${i}]`
      );
    }
  }
}

function validateDischargeResources(bundle, errors) {
  const patient = getResource(bundle, "Patient");
  const patientReference = patient?.id ? `Patient/${patient.id}` : null;
  const diagnosticReports = getResources(bundle, "DiagnosticReport");
  if (diagnosticReports.length > 0) {
    return;
  }
  const conditions = getResources(bundle, "Condition");
  const compositions = getResources(bundle, "Composition");

  if (conditions.length === 0 && compositions.length === 0) {
    addError(
      errors,
      "DISCHARGE_CLINICAL_RESOURCE_MISSING",
      "Discharge bundle must include Condition or Composition resource",
      "entry[Condition|Composition]"
    );
  }

  for (let i = 0; i < conditions.length; i += 1) {
    const condition = conditions[i];
    if (patientReference && condition?.subject?.reference !== patientReference) {
      addError(
        errors,
        "CONDITION_SUBJECT_INVALID",
        "Condition subject must reference the Patient resource",
        `Condition[${i}].subject.reference`
      );
    }
    if (!condition?.code?.text) {
      addError(
        errors,
        "CONDITION_CODE_MISSING",
        "Condition.code.text is required",
        `Condition[${i}].code.text`
      );
    }
  }
}

export function validateClaimBundle(bundle) {
  const errors = [];

  if (bundle?.resourceType !== "Bundle") {
    addError(errors, "BUNDLE_RESOURCE_TYPE_INVALID", "resourceType must be Bundle", "resourceType");
  }

  if (!Array.isArray(bundle?.meta?.profile) || !bundle.meta.profile.includes(CLAIM_BUNDLE_PROFILE)) {
    addError(
      errors,
      "BUNDLE_PROFILE_MISSING",
      "NHCX claim bundle profile is missing",
      "meta.profile"
    );
  }

  collectResourceIds(bundle, errors);
  validatePatientAndDocumentReference(bundle, errors);
  validateDiagnosticResources(bundle, errors);
  validateDischargeResources(bundle, errors);

  const hasClinicalResource =
    getResources(bundle, "DiagnosticReport").length > 0 ||
    getResources(bundle, "Observation").length > 0 ||
    getResources(bundle, "Condition").length > 0 ||
    getResources(bundle, "Composition").length > 0;
  if (!hasClinicalResource) {
    addError(
      errors,
      "CLINICAL_RESOURCE_MISSING",
      "At least one clinical resource (DiagnosticReport/Observation/Condition/Composition) is required",
      "entry"
    );
  }

  return {
    status: errors.length === 0 ? "pass" : "fail",
    errors
  };
}

export function validateClaimBundles(bundles) {
  const bundleReports = bundles.map((bundle, index) => ({
    bundleIndex: index,
    ...validateClaimBundle(bundle)
  }));

  return {
    status: bundleReports.every((report) => report.status === "pass") ? "pass" : "fail",
    bundleReports
  };
}
