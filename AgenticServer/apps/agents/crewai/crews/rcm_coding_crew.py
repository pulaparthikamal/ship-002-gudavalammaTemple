from __future__ import annotations

import json
from typing import Any

from crewai import Agent, LLM, Process, Task

from .base import BaseCrew
from .registry import register_crew


@register_crew("rcm_coding")
class RcmCodingCrew(BaseCrew):
    """
    CrewAI setup for outpatient encounter coding support.

    The crew suggests diagnosis and procedure codes from encounter
    documentation, but downstream systems still own clinician review and final
    claim responsibility.
    """

    def __init__(
        self,
        service_settings=None,
        llm_config: dict[str, Any] | None = None,
        process_type: Process = Process.sequential,
    ) -> None:
        self.llm_config = llm_config or {}
        super().__init__(service_settings=service_settings, process_type=process_type)

    def _build_llm(self) -> LLM:
        provider = str(self.llm_config.get("provider") or "ollama").strip().lower()
        llm_model = str(self.llm_config.get("llm_model") or "").strip()
        ollama_model = str(self.llm_config.get("ollama_model") or "").strip()
        temperature = float(self.llm_config.get("temperature") or 0.4)

        if provider == "openai":
            model = llm_model or "gpt-4o-mini"
            kwargs = {
                "model": model,
                "temperature": temperature,
            }
            openai_api_key = self.llm_config.get("openai_api_key")
            openai_base_url = self.llm_config.get("openai_base_url")
            if openai_api_key:
                kwargs["api_key"] = openai_api_key
            if openai_base_url:
                kwargs["base_url"] = openai_base_url
            return LLM(**kwargs)

        model = llm_model or ollama_model
        if provider == "ollama" and model and not model.startswith("ollama/"):
            model = f"ollama/{model}"

        return LLM(
            model=model,
            base_url=self.llm_config.get("ollama_base_url"),
            temperature=temperature,
            api_key="NA",
        )

    def setup_agents(self, inputs: dict[str, Any]) -> list[Agent]:
        reviewer = Agent(
            role="Clinical Documentation Reviewer",
            goal="Extract the clinically relevant facts that support compliant coding.",
            backstory=(
                "You review outpatient documentation conservatively. You do not "
                "invent symptoms, diagnoses, or services that are not charted."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        diagnosis_coder = Agent(
            role="Diagnosis Coding Specialist",
            goal="Map documented conditions to the most supportable ICD-10-CM diagnosis suggestions.",
            backstory=(
                "You are a professional medical coder focused on diagnosis coding "
                "accuracy, specificity, and documentation support."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        procedure_coder = Agent(
            role="Procedure Coding Specialist",
            goal="Map documented services to the most supportable Charge Master procedure suggestions, including CPT, HCPCS, and dental CDT codes.",
            backstory=(
                "You are a professional medical coder focused on outpatient E/M, "
                "CPT, HCPCS, and dental CDT selection with conservative reasoning."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        auditor = Agent(
            role="Coding Quality Auditor",
            goal="Produce a clean, structured coding recommendation with only supportable suggestions and validation of existing codes.",
            backstory=(
                "You are the final quality gate. You return strict JSON and call "
                "out documentation gaps instead of guessing. You also evaluate if "
                "the codes already provided on the record are accurate based on the note."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        validator = Agent(
            role="Coding Compliance Validator",
            goal="Evaluate if existing diagnosis and procedure codes are accurately supported by clinical documentation.",
            backstory=(
                "You are an expert auditor. You compare the codes already assigned to "
                "a charge against the clinical note. You flag upcoding, downcoding, "
                "or mismatched diagnoses based on evidence."
            ),
            llm=self.llm,
            allow_delegation=False,
        )
        return [reviewer, diagnosis_coder, procedure_coder, validator, auditor]

    def setup_tasks(self, agents: list[Agent], inputs: dict[str, Any]) -> list[Task]:
        reviewer, diagnosis_coder, procedure_coder, validator, auditor = agents

        encounter_context = json.dumps(
            {
                "encounterNote": inputs.get("encounter_note"),
                "clinicalNotes": inputs.get("clinical_notes"),
                "serviceDate": inputs.get("service_date"),
                "appointmentType": inputs.get("appointment_type"),
                "visit_type": inputs.get("visit_type"),
                "appointmentReason": inputs.get("appointment_reason"),
                "appointmentNotes": inputs.get("appointment_notes"),
                "patientAge": inputs.get("patient_age"),
                "patientGender": inputs.get("patient_gender"),
                "patientSex": inputs.get("patient_sex"),
                "chiefComplaint": inputs.get("chief_complaint"),
                "historyOfPresentIllness": inputs.get("history_of_present_illness"),
                "providerSpecialty": inputs.get("provider_specialty"),
                "providerCredentials": inputs.get("provider_credentials"),
                "providerType": inputs.get("provider_type"),
                "facilityName": inputs.get("facility_name"),
                "placeOfServiceCode": inputs.get("place_of_service_code"),
                "vitals": inputs.get("vitals"),
                "patientHistory": inputs.get("patient_history"),
                "existingDiagnosisCodes": inputs.get("existing_diagnosis_codes", []),
                "existingProcedureCodes": inputs.get("existing_procedure_codes", []),
                "requestedCodeTypes": inputs.get("requested_code_types", []),
            },
            default=str,
            ensure_ascii=True,
        )
        procedure_reference_context = json.dumps(
            inputs.get("procedure_reference_context", []),
            default=str,
            ensure_ascii=True,
        )

        review_task = Task(
            description=(
                "Review the outpatient encounter documentation and summarize only the "
                "coded clinical facts, documented problems, documented services, and "
                "any missing documentation that limits confident coding. Treat "
                "clinicalNotes as the source of truth. Use chief complaint, history of "
                "present illness, and structured visit context only as supporting "
                "context when they do not conflict with clinicalNotes. If structured "
                "context conflicts with clinicalNotes, follow clinicalNotes and call "
                "out the conflict for downstream coding. Do not restate a patient "
                "status, visit type, or service level unless it appears in clinicalNotes "
                "or is directly supported there.\n\n"
                f"Encounter Context:\n{encounter_context}"
            ),
            expected_output="A concise documentation review for downstream coding.",
            agent=reviewer,
        )
        diagnosis_task = Task(
            description=(
                "Using the documentation review, suggest only supportable ICD-10-CM "
                "diagnosis codes. If Procedure Reference Context is provided, diagnosis "
                "codes must come only from the diagnosisRestrictions attached to Charge "
                "Master entries that are supportable from the documentation. Do not "
                "invent ICD-10-CM codes or descriptions outside that Charge Master "
                "context. Use diagnosisRestrictions as an allowed set only; do not "
                "include a diagnosis merely because it is configured on a Charge Master "
                "entry. Include every separately documented diagnosis, symptom, or "
                "condition that is clinically relevant to the selected procedure and "
                "present in diagnosisRestrictions. Do not collapse a documented symptom "
                "into the underlying condition when both are separately documented and "
                "both are allowed. Do not add a nonspecific symptom diagnosis when "
                "the documentation provides a more specific definitive dental condition "
                "that explains the symptom, such as abscess, periapical disease, pulp "
                "disease, caries, or infection. Only add the symptom diagnosis when "
                "documentation supports it as a separate billable diagnosis. "
                "Do not select routine, normal, or no-abnormal-finding examination "
                "diagnoses when clinicalNotes document abnormal findings, active problems, "
                "symptoms, or disease. Select the abnormal/problem examination diagnosis "
                "when it is available and supported. If no configured diagnosis restriction is supportable, return "
                "an empty diagnosisCodes list and add a suggestedFix. Suggest only "
                "additional diagnosis codes that are not already present in "
                "existingDiagnosisCodes. Never repeat an existing diagnosis code. Prefer "
                "specificity when the configured Charge Master restriction supports it. "
                "Return every directly supported diagnosis code from the configured "
                "Charge Master restrictions and return none when support is missing.\n\n"
                f"Procedure Reference Context:\n{procedure_reference_context}\n\n"
                "Return JSON only with this shape:\n"
                "{\"diagnosisCodes\":[{\"code\":\"...\",\"description\":\"...\","
                "\"confidence\":0.0,\"reasoning\":\"...\"}],"
                "\"suggestedFixes\":[\"...\"]}"
            ),
            expected_output="JSON with diagnosisCodes and suggestedFixes only.",
            agent=diagnosis_coder,
            context=[review_task],
        )
        procedure_task = Task(
            description=(
                "Using the documentation review, suggest only supportable Charge Master "
                "procedure codes, including CPT, HCPCS, and dental CDT codes. Procedure Reference Context is the active Charge Master "
                "catalog for this encounter. Choose procedure codes only from that list "
                "when it is provided, and use each Charge Master entry's description as "
                "the source of truth for the procedure description. Review every Charge "
                "Master entry before deciding. If the note documents the same service "
                "using different wording than the Charge Master description, select the "
                "supported Charge Master entry and explain the evidence. When multiple "
                "Charge Master entries could apply to the same service family, select "
                "the entry whose qualifiers most specifically match clinicalNotes, such "
                "as established, new, recall, periodic, comprehensive, limited, emergency, "
                "adult, child, image count, tooth number, or surface. Do not select a "
                "broader or higher-intensity Charge Master entry when a narrower active "
                "entry is directly supported by clinicalNotes. For each selected procedure, "
                "match dental radiograph image type and count exactly. Do not select a "
                "complete series/full-mouth radiographic code unless clinicalNotes explicitly "
                "document a complete series, full mouth series, FMX, or equivalent full-series "
                "imaging. A single periapical radiograph must use the active periapical "
                "Charge Master entry, not a complete series entry. "
                "For each selected procedure, "
                "include an exact short phrase from clinicalNotes in reasoning. Dental CDT "
                "codes such as D0120, D0274, D1110, D1120, and D1206 are valid procedure "
                "codes when they appear in Procedure Reference Context and are supported "
                "by clinicalNotes. Put every procedure suggestion, including dental CDT "
                "codes, in the procedureCodes array. Do not use cdtCodes, dentalCodes, "
                "or separate dental procedure arrays. Do not invent CPT, HCPCS, CDT, procedure descriptions, "
                "or services outside the catalog. Suggest "
                "only additional procedure codes that are not already present in "
                "existingProcedureCodes. Never repeat an existing procedure code. For "
                "E/M suggestions, require documentation that supports the service level. "
                "If time or MDM support is missing, return fewer codes and add "
                "suggestedFixes. Return every directly supported procedure code from "
                "the active Charge Master catalog and return none when support is missing.\n\n"
                f"Procedure Reference Context:\n{procedure_reference_context}\n\n"
                "Return JSON only with this shape:\n"
                "{\"procedureCodes\":[{\"code\":\"...\",\"description\":\"...\","
                "\"confidence\":0.0,\"reasoning\":\"...\",\"units\":1}],"
                "\"suggestedFixes\":[\"...\"]}"
            ),
            expected_output="JSON with procedureCodes and suggestedFixes only.",
            agent=procedure_coder,
            context=[review_task],
        )
        validation_task = Task(
            description=(
                "Using the documentation review, evaluate each code already present in "
                "existingDiagnosisCodes and existingProcedureCodes.\n\n"
                "For each code, determine if it is:\n"
                "- Valid: Supported by documentation.\n"
                "- Invalid: Not supported by documentation or explicitly contradicted.\n"
                "- Optimization Suggested: A more specific or accurate code exists.\n\n"
                "Return JSON only with this shape:\n"
                "{\"validationResults\":[{\"code\":\"...\",\"codeType\":\"diagnosis|procedure\","
                "\"status\":\"Valid|Invalid|Optimization Suggested\",\"reasoning\":\"...\","
                "\"suggestedAlternative\":\"...\"}]}"
            ),
            expected_output="JSON with validationResults only.",
            agent=validator,
            context=[review_task],
        )
        audit_task = Task(
            description=(
                "Combine the clinical review, diagnosis suggestions, procedure "
                "suggestions, and validation results into a final outpatient coding recommendation.\n\n"
                "Rules:\n"
                "- Return strict JSON only.\n"
                "- In summary, briefly state the documentation basis used for coding and validation.\n"
                "- Keep diagnosisCodes limited to ICD-10-CM suggestions.\n"
                "- Keep procedureCodes limited to Charge Master procedure suggestions, including CPT, HCPCS, and dental CDT codes.\n"
                "- Dental CDT codes are valid when they appear in Procedure Reference Context and are supported by documentation; do not reject them for not being CPT/HCPCS.\n"
                "- Put every procedure suggestion, including dental CDT codes, in the procedureCodes array. Do not use cdtCodes, dentalCodes, or separate dental procedure arrays.\n"
                "- If Procedure Reference Context is provided, every procedureCode must come from that Charge Master list.\n"
                "- Procedure descriptions must match the selected Charge Master entry descriptions.\n"
                "- Diagnosis codes must come only from diagnosisRestrictions on selected Charge Master entries.\n"
                "- validationResults is only for codes already present in existingDiagnosisCodes and existingProcedureCodes.\n"
                "- Do not place new recommendations only in validationResults. If a code is recommended for this encounter, it must also appear in diagnosisCodes or procedureCodes.\n"
                "- Preserve every supportable code returned by the diagnosis and procedure tasks unless it violates these rules.\n"
                "- Use uppercase code values.\n"
                "- Include the validation results for all existing codes.\n"
                "- If documentation is thin, keep confidence lower and add suggestedFixes.\n\n"
                "- Do not mention procedure or diagnosis code values in suggestedFixes "
                "unless that exact code is already present in diagnosisCodes, "
                "procedureCodes, existingDiagnosisCodes, existingProcedureCodes, or "
                "validationResults. Describe missing documentation or Charge Master "
                "setup gaps in words instead.\n\n"
                "Return this exact shape:\n"
                "{\"status\":\"success\",\"summary\":\"...\","
                "\"diagnosisCodes\":[{\"code\":\"...\",\"description\":\"...\","
                "\"confidence\":0.0,\"reasoning\":\"...\"}],"
                "\"procedureCodes\":[{\"code\":\"...\",\"description\":\"...\","
                "\"confidence\":0.0,\"reasoning\":\"...\",\"units\":1}],"
                "\"validationResults\":[{\"code\":\"...\",\"codeType\":\"...\",\"status\":\"...\",\"reasoning\":\"...\",\"suggestedAlternative\":\"...\"}],"
                "\"suggestedFixes\":[\"...\"]}"
            ),
            expected_output=(
                "JSON only with status, summary, diagnosisCodes, procedureCodes, validationResults, and suggestedFixes."
            ),
            agent=auditor,
            context=[review_task, diagnosis_task, procedure_task, validation_task],
        )
        return [review_task, diagnosis_task, procedure_task, validation_task, audit_task]
