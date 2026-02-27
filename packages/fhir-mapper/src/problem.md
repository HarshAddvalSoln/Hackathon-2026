Problem Statement Title
Clinical Documents to FHIR Structured Data Convertor (specifically  Diagnostic Report and Discharge Summary)

Category
FHIR Utility for Providers

Core Problem
Hospitals still use PDF-based health documents; ABDM requires structured Health Information Types

Primary Stakeholder
Hospitals, HMIS 

Desired output
Open source micro-service for PDF-to-HI type convertor 

In claim submission and insurer query workflows, clinical documents such as discharge summaries, diagnostic reports, and prescriptions are exchanged as supporting evidence for claim processing and responding to queries raised by insurance companies. However, these documents are predominantly available in PDF format, which is suitable for human review but not for interoperable, standardised data exchange. To enable interoperability across ABDM and NHCX-compliant systems, such information needs to be shared as structured data conforming to defined FHIR profiles. In the context of claim submission and communication, converting PDF-based clinical documents into structured FHIR resources is largely manual or depends on document-specific custom integrations, making the process time-consuming and creating a significant adoption barrier for HMIS vendors and hospitals participating in NHCX-enabled workflows.

Problem Statement
Develop an open-source service that can be a micro-service or a library that ingests healthcare documents in PDF format and converts them into ABDM FHIR profiles and NHCX profiles based on the use case of claim submission or pre-authorisation.


The solution should:
Address one of the use cases, claim submission or pre-authorisation. For e.g., in Claim submission use case, it takes Input such as multiple documents to be provided for that Claim submission and the relevant PDFs (such as discharge summaries, lab reports, or clinical summaries) 
Accept input of clinical documents in the PDF format
Detect the relevant HI type (discharge summary / diagnostic report)
Transform extracted data into appropriate FHIR resources
Output FHIR bundles conforming to FHIR-based NHCX profiles for claim submission
Include validation against NRCeS-defined NHCX profiles with clear error reporting
Be configuration-driven and reusable across HMIS and healthcare applications
Note: Shortlisted solutions will be required to provide a brief demo for the Jury on 3rd March 2026.

Objective
To significantly reduce the manual effort required to convert PDF-based healthcare information into NHCX-aligned FHIR bundles, enabling faster onboarding and interoperability within the ABDM ecosystem.