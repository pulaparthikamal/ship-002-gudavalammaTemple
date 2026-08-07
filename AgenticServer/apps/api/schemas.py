from __future__ import annotations
from typing import Any, List, Optional, Dict
from pydantic import BaseModel, Field, HttpUrl, model_validator


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized_value = value.strip()
    return normalized_value or None


def _normalize_unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized_values: list[str] = []

    for value in values:
        normalized_value = _normalize_text(value)
        if not normalized_value:
            continue

        key = normalized_value.upper()
        if key in seen:
            continue

        seen.add(key)
        normalized_values.append(normalized_value)

    return normalized_values


def _normalize_requested_code_types(values: list[str]) -> list[str]:
    normalized_values: list[str] = []
    seen: set[str] = set()

    for value in values:
        normalized_value = _normalize_text(value)
        if not normalized_value:
            continue

        key = normalized_value.lower()
        if key not in {"diagnosis", "procedure"} or key in seen:
            continue

        seen.add(key)
        normalized_values.append(key)

    return normalized_values

class ContentGenerationRequest(BaseModel):
    topic_id: str | None = Field(default=None, alias="topicId")
    topic: str | None = None
    use_topic_queue: bool = Field(default=False, alias="useTopicQueue")
    research_text: str | None = Field(default=None, alias="researchText")
    source_urls: list[HttpUrl] = Field(default_factory=list, alias="sourceUrls")
    search_enabled: bool = Field(default=True, alias="searchEnabled")
    audience: str = "Business and LinkedIn readers"
    tone: str = "Professional, practical, and confident"
    brand_voice: str | None = Field(default=None, alias="brandVoice")
    keywords: list[str] = Field(default_factory=list)
    call_to_action: str | None = Field(default=None, alias="callToAction")
    word_count: int = Field(default=800, alias="wordCount", ge=250, le=1800)
    save_result: bool | None = Field(default=None, alias="saveResult")
    mark_topic_processed: bool | None = Field(default=None, alias="markTopicProcessed")
    metadata: dict[str, Any] = Field(default_factory=dict)
    crew_type: str = Field(default="content", alias="crewType")
    include_debug: bool = Field(default=False, alias="includeDebug")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

    @model_validator(mode="after")
    def validate_input_sources(self) -> "ContentGenerationRequest":
        has_source = any(
            [
                self.topic_id,
                self.topic,
                self.use_topic_queue,
                self.research_text,
                self.source_urls,
            ]
        )
        if not has_source:
            raise ValueError(
                "Provide at least one of topic_id, topic, use_topic_queue, research_text, or source_urls."
            )
        return self

class ResolvedTopic(BaseModel):
    topic_id: str | None = None
    topic: str
    mongo_document: dict[str, Any] | None = None
    additional_context: str | None = None

class ResearchBundle(BaseModel):
    topic: str
    research_text: str
    source_urls: list[str] = Field(default_factory=list)
    scraped_images: list[dict[str, str]] = Field(default_factory=list)
    source_count: int = 0
    creator_research: dict[str, Any] | None = None

class ContentGenerationResponse(BaseModel):
    status: str
    message: str
    request_id: str
    topic: str
    title: str
    summary: str
    content: str
    final_content: str
    hashtags: list[str]
    keywords: list[str]
    source_urls: list[str]
    source_count: int
    image_prompt: str | None = Field(default=None, alias="imagePrompt")
    instagram_image: str | None = Field(default=None, alias="instagramImage")
    instagram_images: list[str] = Field(default_factory=list, alias="instagramImages")
    instagram_html: str | None = Field(default=None, alias="instagramHtml")
    instagram_slides: list[str] = Field(default_factory=list, alias="instagramSlides")
    platform_specific_content: dict[str, Any] | None = Field(default=None, alias="platformSpecificContent")
    additional_information: dict[str, Any] | None = Field(default=None, alias="additionalInformation")
    generation_brief: dict[str, Any] | None = Field(default=None, alias="generationBrief")
    output_collection_id: str | None = None
    debug: dict[str, Any] | None = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class HealthResponse(BaseModel):
    status: str
    service: str
    llm_provider: str
    ollama_reachable: bool
    llm_model: str
    llm_base_url: str | None
    mongo_configured: bool


class MaintenanceFile(BaseModel):
    fileName: str
    path: str
    sizeMb: float = 0
    lastAccessed: Any | None = None
    category: str
    tags: list[str] = Field(default_factory=list)

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class MaintenanceDecisionRequest(BaseModel):
    serverId: str
    files: list[MaintenanceFile] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)
    openAiKey: str | None = Field(default=None, alias="openAiKey")
    llmProvider: str | None = Field(default=None, alias="llmProvider")
    llmModel: str | None = Field(default=None, alias="llmModel")
    llmBaseUrl: str | None = Field(default=None, alias="llmBaseUrl")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class MaintenanceDecision(BaseModel):
    path: str
    action: str
    confidence: float
    reason: str
    decisionTrace: list[str] = Field(default_factory=list)


class MaintenanceDecisionResponse(BaseModel):
    status: str
    decisions: list[MaintenanceDecision]
    crewaiUsed: bool = False

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


# RCM AI Schemas

class RcmEncounterVitalsContext(BaseModel):
    temperature: float | None = None
    blood_pressure: str | None = Field(default=None, alias="bloodPressure")
    pulse: float | None = None
    height: float | None = None
    weight: float | None = None
    bmi: float | None = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

    @model_validator(mode="after")
    def normalize_input(self) -> "RcmEncounterVitalsContext":
        self.blood_pressure = _normalize_text(self.blood_pressure)
        return self


class RcmProcedureReferenceItem(BaseModel):
    code: str
    description: str | None = None
    place_of_service: str | None = Field(default=None, alias="placeOfService")
    default_charge_amount: float | None = Field(default=None, alias="defaultChargeAmount")
    modifiers_allowed: list[str] = Field(default_factory=list, alias="modifiersAllowed")
    diagnosis_restrictions: list[str] = Field(default_factory=list, alias="diagnosisRestrictions")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

    @model_validator(mode="after")
    def normalize_input(self) -> "RcmProcedureReferenceItem":
        self.code = self.code.strip().upper()
        self.description = _normalize_text(self.description)
        self.place_of_service = _normalize_text(self.place_of_service)
        self.modifiers_allowed = _normalize_unique_strings(self.modifiers_allowed)
        self.diagnosis_restrictions = _normalize_unique_strings(self.diagnosis_restrictions)
        return self

class RcmCodeSuggestionRequest(BaseModel):
    encounter_note: str | None = Field(default=None, alias="encounterNote")
    clinical_notes: str | None = Field(default=None, alias="clinicalNotes")
    patient_history: Optional[str] = Field(default=None, alias="patientHistory")
    appointment_type: Optional[str] = Field(default=None, alias="appointmentType")
    visit_type: Optional[str] = Field(default=None, alias="visitType")
    appointment_reason: Optional[str] = Field(default=None, alias="appointmentReason")
    appointment_notes: Optional[str] = Field(default=None, alias="appointmentNotes")
    service_date: Optional[str] = Field(default=None, alias="serviceDate")
    patient_age: Optional[int] = Field(default=None, alias="patientAge")
    patient_gender: Optional[str] = Field(default=None, alias="patientGender")
    patient_sex: Optional[str] = Field(default=None, alias="patientSex")
    chief_complaint: Optional[str] = Field(default=None, alias="chiefComplaint")
    history_of_present_illness: Optional[str] = Field(default=None, alias="historyOfPresentIllness")
    provider_specialty: Optional[str] = Field(default=None, alias="providerSpecialty")
    provider_credentials: Optional[str] = Field(default=None, alias="providerCredentials")
    provider_type: Optional[str] = Field(default=None, alias="providerType")
    facility_name: Optional[str] = Field(default=None, alias="facilityName")
    place_of_service_code: Optional[str] = Field(default=None, alias="placeOfServiceCode")
    vitals: Optional[RcmEncounterVitalsContext] = None
    procedure_reference_context: List[RcmProcedureReferenceItem] = Field(default_factory=list, alias="procedureReferenceContext")
    existing_codes: List[str] = Field(default_factory=list, alias="existingCodes")
    existing_diagnosis_codes: List[str] = Field(default_factory=list, alias="existingDiagnosisCodes")
    existing_procedure_codes: List[str] = Field(default_factory=list, alias="existingProcedureCodes")
    requested_code_types: List[str] = Field(default_factory=list, alias="requestedCodeTypes")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

    @model_validator(mode="after")
    def normalize_input(self) -> "RcmCodeSuggestionRequest":
        encounter_note = _normalize_text(self.encounter_note)
        clinical_notes = _normalize_text(self.clinical_notes)
        encounter_note = encounter_note or clinical_notes
        if not encounter_note:
            raise ValueError("encounterNote or clinicalNotes is required.")

        self.encounter_note = encounter_note
        self.clinical_notes = clinical_notes or encounter_note
        self.patient_history = _normalize_text(self.patient_history)
        self.appointment_type = _normalize_text(self.appointment_type)
        self.visit_type = _normalize_text(self.visit_type)
        self.appointment_reason = _normalize_text(self.appointment_reason)
        self.appointment_notes = _normalize_text(self.appointment_notes)
        self.service_date = _normalize_text(self.service_date)
        self.patient_gender = _normalize_text(self.patient_gender)
        self.patient_sex = _normalize_text(self.patient_sex)
        self.chief_complaint = _normalize_text(self.chief_complaint)
        self.history_of_present_illness = _normalize_text(self.history_of_present_illness)
        self.provider_specialty = _normalize_text(self.provider_specialty)
        self.provider_credentials = _normalize_text(self.provider_credentials)
        self.provider_type = _normalize_text(self.provider_type)
        self.facility_name = _normalize_text(self.facility_name)
        self.place_of_service_code = _normalize_text(self.place_of_service_code)
        if isinstance(self.patient_age, int) and self.patient_age < 0:
            self.patient_age = None
        self.existing_diagnosis_codes = _normalize_unique_strings(self.existing_diagnosis_codes)
        self.existing_procedure_codes = _normalize_unique_strings(self.existing_procedure_codes)
        self.existing_codes = _normalize_unique_strings(
            [
                *self.existing_codes,
                *self.existing_diagnosis_codes,
                *self.existing_procedure_codes,
            ]
        )
        self.requested_code_types = (
            _normalize_requested_code_types(self.requested_code_types)
            or ["diagnosis", "procedure"]
        )
        return self

class SuggestedCode(BaseModel):
    code: str
    description: str
    confidence: float
    reasoning: str
    units: int | None = None

class RcmCodeValidationResult(BaseModel):
    code: str
    code_type: str = Field(alias="codeType")
    status: str
    reasoning: str
    suggested_alternative: str | None = Field(default=None, alias="suggestedAlternative")

class RemediationToolDefinition(BaseModel):
    name: str
    description: str
    riskLevel: str
    requiresApproval: bool
    supportsRollback: bool = False
    inputSchema: dict[str, str] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RemediationPlanRequest(BaseModel):
    serverId: str
    intent: str
    context: dict[str, Any] = Field(default_factory=dict)
    tools: list[RemediationToolDefinition] = Field(default_factory=list)
    openAiKey: str | None = Field(default=None, alias="openAiKey")
    llmProvider: str | None = Field(default=None, alias="llmProvider")
    llmModel: str | None = Field(default=None, alias="llmModel")
    llmBaseUrl: str | None = Field(default=None, alias="llmBaseUrl")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RemediationToolCall(BaseModel):
    toolName: str
    args: dict[str, Any] = Field(default_factory=dict)
    reasoning: str | None = None

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RemediationPlan(BaseModel):
    goal: str
    summary: str
    target: str
    description: str
    planner: str
    decisionTrace: list[str] = Field(default_factory=list)
    riskLevel: str = "medium"
    requiresApproval: bool = True
    steps: list[RemediationToolCall] = Field(default_factory=list)
    rollbackSteps: list[RemediationToolCall] = Field(default_factory=list)
    contextSnapshot: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RemediationPlanResponse(BaseModel):
    status: str
    plan: RemediationPlan
    crewaiUsed: bool = False
    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmCodeSuggestionResponse(BaseModel):
    status: str
    summary: str | None = None
    diagnosis_codes: List[SuggestedCode] = Field(default_factory=list, alias="diagnosisCodes")
    procedure_codes: List[SuggestedCode] = Field(default_factory=list, alias="procedureCodes")
    suggested_codes: List[SuggestedCode] = Field(default_factory=list, alias="suggestedCodes")
    suggested_fixes: List[str] = Field(default_factory=list, alias="suggestedFixes")
    validation_results: List[RcmCodeValidationResult] = Field(default_factory=list, alias="validationResults")
    crewai_used: bool = Field(default=False, alias="crewaiUsed")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RcmCodingReviewFailureExplanationRequest(BaseModel):
    review: Dict[str, Any] = Field(default_factory=dict)
    charge: Dict[str, Any] = Field(default_factory=dict)
    encounter: Dict[str, Any] = Field(default_factory=dict)
    validation_errors: List[str] = Field(default_factory=list, alias="validationErrors")
    modifier_issues: List[str] = Field(default_factory=list, alias="modifierIssues")
    payer_specific_rule_failures: List[str] = Field(default_factory=list, alias="payerSpecificRuleFailures")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RcmCodingReviewFailureIssue(BaseModel):
    line_number: int | None = Field(default=None, alias="lineNumber")
    field: str
    title: str
    explanation: str
    correction: str
    source: str

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class RcmCodingReviewFailureExplanationResponse(BaseModel):
    status: str
    summary: str | None = None
    issues: List[RcmCodingReviewFailureIssue] = Field(default_factory=list)
    suggested_fixes: List[str] = Field(default_factory=list, alias="suggestedFixes")
    crewai_used: bool = Field(default=False, alias="crewaiUsed")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmDenialPredictionRequest(BaseModel):
    claim_data: Dict[str, Any] = Field(alias="claimData")
    payer_id: str = Field(alias="payerId")

class RcmDenialPredictionResponse(BaseModel):
    status: str
    denial_probability: float = Field(alias="denialProbability")
    potential_rejection_reasons: List[str] = Field(alias="potentialRejectionReasons")
    recommended_actions: List[str] = Field(alias="recommendedActions")

class RcmAuthPredictionRequest(BaseModel):
    cpt_code: str = Field(alias="cptCode")
    payer_id: str = Field(alias="payerId")
    diagnosis_codes: List[str] = Field(default_factory=list, alias="diagnosisCodes")

class RcmAuthPredictionResponse(BaseModel):
    status: str
    requires_auth: bool = Field(alias="requiresAuth")
    confidence: float
    rule_source: str = Field(alias="ruleSource")

class RcmDependentValidationRequest(BaseModel):
    patient: Dict[str, Any] = Field(default_factory=dict)
    insurance_policy: Dict[str, Any] = Field(default_factory=dict, alias="insurancePolicy")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmDependentValidationResponse(BaseModel):
    status: str
    risk_score: float = Field(alias="riskScore")
    issues: List[str] = Field(default_factory=list)
    suggested_fixes: List[str] = Field(default_factory=list, alias="suggestedFixes")
    source: str

class RcmAckRejectionAnalysisRequest(BaseModel):
    claim_tracking: Dict[str, Any] = Field(default_factory=dict, alias="claimTracking")
    claim: Dict[str, Any] = Field(default_factory=dict)
    claim_submission: Dict[str, Any] = Field(default_factory=dict, alias="claimSubmission")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmAckRejectionAnalysisResponse(BaseModel):
    status: str
    root_cause: str = Field(alias="rootCause")
    correction_type: str = Field(alias="correctionType")
    affected_fields: List[str] = Field(default_factory=list, alias="affectedFields")
    recommended_actions: List[str] = Field(default_factory=list, alias="recommendedActions")
    corrected_claim_recommended: bool = Field(default=False, alias="correctedClaimRecommended")
    priority: str = "MEDIUM"
    confidence: float = 0.0
    source: str = "agentic-ack-rejection-v1"

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmDenialAnalysisRequest(BaseModel):
    denial: Dict[str, Any] = Field(default_factory=dict)
    claim: Dict[str, Any] = Field(default_factory=dict)
    payment_posting: Dict[str, Any] = Field(default_factory=dict, alias="paymentPosting")
    era: Dict[str, Any] = Field(default_factory=dict)
    ar_work_item: Dict[str, Any] = Field(default_factory=dict, alias="arWorkItem")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmDenialAnalysisResponse(BaseModel):
    status: str
    root_cause: str = Field(alias="rootCause")
    recommendation: str
    recommendation_reason: str = Field(alias="recommendationReason")
    evidence_needed: List[str] = Field(default_factory=list, alias="evidenceNeeded")
    missing_documentation: List[str] = Field(default_factory=list, alias="missingDocumentation")
    payer_policy_notes: List[str] = Field(default_factory=list, alias="payerPolicyNotes")
    next_best_action: str = Field(alias="nextBestAction")
    confidence: float = 0.0
    source: str = "agentic-denial-analysis-v1"

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmAppealPacketRequest(BaseModel):
    appeal: Dict[str, Any] = Field(default_factory=dict)
    denial: Dict[str, Any] = Field(default_factory=dict)
    claim: Dict[str, Any] = Field(default_factory=dict)
    ar_work_item: Dict[str, Any] = Field(default_factory=dict, alias="arWorkItem")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmAppealPacketResponse(BaseModel):
    status: str
    appeal_letter_draft: str = Field(alias="appealLetterDraft")
    evidence_checklist: List[str] = Field(default_factory=list, alias="evidenceChecklist")
    medical_necessity_argument: str | None = Field(default=None, alias="medicalNecessityArgument")
    payer_specific_argument: str | None = Field(default=None, alias="payerSpecificArgument")
    missing_docs: List[str] = Field(default_factory=list, alias="missingDocs")
    overturn_probability: float = Field(default=0.0, alias="overturnProbability")
    confidence: float = 0.0
    source: str = "agentic-appeal-packet-v1"

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmEraMatchExceptionRequest(BaseModel):
    era_exception: Dict[str, Any] = Field(default_factory=dict, alias="eraException")
    era: Dict[str, Any] = Field(default_factory=dict)
    payment_posting: Dict[str, Any] = Field(default_factory=dict, alias="paymentPosting")
    claim: Dict[str, Any] = Field(default_factory=dict)
    denial: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmEraMatchExceptionResponse(BaseModel):
    status: str
    explanation: str
    likely_match: Dict[str, Any] = Field(default_factory=dict, alias="likelyMatch")
    ambiguity_reasons: List[str] = Field(default_factory=list, alias="ambiguityReasons")
    recommended_actions: List[str] = Field(default_factory=list, alias="recommendedActions")
    confidence: float = 0.0
    source: str = "agentic-era-match-exception-v1"

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmArPrioritizationRequest(BaseModel):
    ar_work_item: Dict[str, Any] = Field(default_factory=dict, alias="arWorkItem")
    claim: Dict[str, Any] = Field(default_factory=dict)
    denial: Dict[str, Any] = Field(default_factory=dict)
    appeal: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class RcmArPrioritizationResponse(BaseModel):
    status: str
    priority: str
    financial_impact: float = Field(default=0.0, alias="financialImpact")
    sla_risk: str = Field(alias="slaRisk")
    recommended_owner_queue: str = Field(alias="recommendedOwnerQueue")
    next_action: str = Field(alias="nextAction")
    reason: str
    confidence: float = 0.0
    source: str = "agentic-ar-prioritization-v1"

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }

class PredictiveMaintenanceRequest(BaseModel):
    serverId: str
    metrics: list[dict[str, Any]] = Field(default_factory=list)
    openAiKey: str | None = Field(default=None, alias="openAiKey")
    llmProvider: str | None = Field(default=None, alias="llmProvider")
    llmModel: str | None = Field(default=None, alias="llmModel")
    llmBaseUrl: str | None = Field(default=None, alias="llmBaseUrl")

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }


class PredictiveIssue(BaseModel):
    issue: str
    predictedFailure: str
    recommendation: str
    rootCauseAnalysis: str | None = None
    severity: str
    affectedComponents: list[str] = Field(default_factory=list)
    impactedServices: list[str] = Field(default_factory=list)
    impactedDirectories: list[str] = Field(default_factory=list)
    timeframe: str = ""
    horizonMinutes: int = 0
    confidence: float = 0.0
    evidence: list[Any] = Field(default_factory=list)
    recommendedActions: list[str] = Field(default_factory=list)


class PredictiveMaintenanceResponse(BaseModel):
    status: str
    predictions: list[PredictiveIssue]
    anomalies: list[dict[str, Any]] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)
    trendAnalysis: dict[str, Any] = Field(default_factory=dict)
    aiGeneratedResponse: bool = True

    model_config = {
        "populate_by_name": True,
        "extra": "allow",
    }
