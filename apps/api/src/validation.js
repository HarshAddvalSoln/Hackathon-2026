function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateConvertRequest(body) {
  const details = [];

  if (!Array.isArray(body?.documents) || body.documents.length === 0) {
    details.push({
      path: "documents",
      message: "documents must be a non-empty array"
    });
  } else {
    body.documents.forEach((document, index) => {
      if (!isNonEmptyString(document?.fileName)) {
        details.push({
          path: `documents[${index}].fileName`,
          message: "fileName is required"
        });
      }
      if (!isNonEmptyString(document?.text)) {
        const hasPdfSource =
          isNonEmptyString(document?.filePath) ||
          isNonEmptyString(document?.base64Pdf) ||
          isNonEmptyString(document?.imageBase64);
        if (!hasPdfSource) {
          details.push({
            path: `documents[${index}].text`,
            message: "text is required when filePath/base64Pdf/imageBase64 is absent"
          });
        }
      }
    });
  }

  return {
    ok: details.length === 0,
    details
  };
}
