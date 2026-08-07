export type MineCareStatus = 'Operational' | 'Under Maintenance' | 'Breakdown' | 'Retired'
export type MineCareCriticality = 'Low' | 'Medium' | 'High' | 'Critical'

export interface MineCareEquipment {
  _id: string
  equipmentId: string
  name: string
  type: string
  brand: string
  model: string
  serialNumber: string
  location: string
  department: string
  purchaseDate: string
  invoiceValue: number
  vendor: string
  currentRunningHours: number
  averageDailyUsage: number
  status: MineCareStatus
  criticality: MineCareCriticality
  created?: string
  updated?: string
  warranty?: MineCareWarranty | null
  serviceSchedule?: Array<{
    _id: string
    equipmentType: string
    serviceName: string
    intervalHours: number
    requiredParts: string[]
    estimatedCost: number
  }>
}

export interface MineCareWarranty {
  _id: string
  equipmentId: string
  startDate: string
  endDate: string
  hourLimit: number
  coveredComponents: string[]
  terms: string
}

export interface MineCareServiceDue {
  equipmentId: string
  equipmentName: string
  serviceName: string
  nextServiceHours: number
  remainingHours: number
  remainingDays: number
  serviceDueDate: string
  estimatedCost: number
  requiredParts: string[]
  status: string
  aiPriority?: string
  aiReason?: string
  aiRecommendedAction?: string
  delayRisk?: string
}

export interface MineCareHealth {
  equipmentId: string
  score: number
  status: string
  riskLevel: string
  recommendations: string[]
}

export interface MineCareRisk {
  equipmentId: string
  equipmentName: string
  type: string
  criticality: MineCareCriticality
  score: number
  priority: string
  healthScore: number
  reasons: string[]
  aiExplanation?: string
  nextBestAction?: string
}

export interface MineCareWarrantyStatus {
  equipmentId: string
  equipmentName?: string
  status: string
  remainingDays: number
  remainingHours: number
  warranty: MineCareWarranty | null
  aiRecommendation?: string
}

export interface MineCareObservation {
  _id: string
  equipmentId: string
  observationDate: string
  observationType: string
  description: string
  severity: string
}

export interface MineCareSparePart {
  _id: string
  partNumber: string
  partName: string
  currentStock: number
  minimumStock: number
  leadTimeDays: number
  unitCost: number
  requiredQuantity: number
  demandSources?: string[]
  projectedStock: number
  reorderRecommended: boolean
  reorderQuantity: number
  reorderCost: number
  aiRecommendation?: string
  shortageRisk?: string
  stockingStrategy?: string
}

export interface MineCareAlert {
  id?: string
  type: string
  severity: string
  status?: 'Open' | 'Acknowledged' | 'Closed'
  equipmentId?: string
  equipmentName?: string
  partNumber?: string
  partName?: string
  message: string
  dueDate?: string
  aiPriorityScore?: number
  aiReason?: string
  recommendedAction?: string
}

export interface MineCareBudgetForecast {
  month: string
  monthlyMaintenanceBudget: number
  serviceCost: number
  riskBuffer: number
  costExposure: number
  potentialSavings: number
  upcomingServiceCount: number
  aiNarrative?: string
  costDrivers?: string[]
  recommendedActions?: string[]
}

export interface MineCareAction {
  id?: string
  priority: string
  status?: 'Open' | 'In Progress' | 'Completed'
  equipment: string
  equipmentName: string
  action: string
  source: string
  dueDate?: string
}

export interface MineCareDashboardSummary {
  cards: {
    totalEquipment: number
    criticalAssets: number
    serviceDueThisWeek: number
    warrantyExpiringSoon: number
    sparePartShortages: number
    estimatedCostExposure: number
    potentialSavings: number
  }
  commandCenter?: {
    fleetHealthPercent: number
    healthyAssets: number
    warningAssets: number
    criticalAssets: number
    serviceDueThisWeek: number
    warrantyRecoveryOpportunity: number
    estimatedDowntimeAvoided: number
    aiEstimatedSavings: number
    costExposure: number
  }
  savings?: MineCareSavings
  topRecommendations?: MineCareRecommendation[]
  healthScoreDistribution: {
    good: number
    medium: number
    highRisk: number
    critical: number
  }
  topRiskAssets: MineCareRisk[]
  upcomingServices: MineCareServiceDue[]
  warrantyAlerts: MineCareAlert[]
  aiExecutiveSummary?: string
  aiDecisionBrief?: string[]
}

export interface MineCareCalendar {
  weeklyCalendar: MineCareServiceDue[]
  monthlyCalendar: MineCareServiceDue[]
  upcomingServices: MineCareServiceDue[]
  overdueServices: MineCareServiceDue[]
  warrantyInspections: MineCareWarrantyStatus[]
  aiSummary?: string
  aiRecommendedPlan?: string[]
}

export interface MineCareMaintenanceRecord {
  _id?: string
  equipmentId: string
  serviceDate: string
  serviceType: string
  runningHours?: number
  actionTaken: string
  technician: string
  cost: number
  downtimeHours: number
}

export interface MineCareBreakdownRecord {
  _id?: string
  equipmentId: string
  breakdownDate: string
  failureType: string
  component?: string
  rootCause: string
  repairCost: number
  downtimeHours: number
  warrantyClaimRaised: boolean
}

export interface MineCareCompleteServicePayload {
  equipmentId: string
  serviceName: string
  serviceDate?: string
  runningHours?: number
  actionTaken?: string
  technician?: string
  cost?: number
  downtimeHours?: number
}

export interface MineCareConsumedPart {
  partNumber: string
  partName: string
  requestedQuantity: number
  consumedQuantity: number
  beforeStock: number
  afterStock: number
  shortageQuantity: number
}

export interface MineCareRecordBreakdownRepairPayload {
  equipmentId: string
  breakdownDate?: string
  failureType: string
  component?: string
  rootCause?: string
  repairCost?: number
  downtimeHours?: number
  warrantyClaimRaised?: boolean
  createMaintenanceRecord?: boolean
  technician?: string
  actionTaken?: string
  runningHours?: number
  repaired?: boolean
}

export interface MineCareEquipmentDetails {
  equipment: MineCareEquipment
  warranty: MineCareWarranty | null
  warrantyStatus: MineCareWarrantyStatus
  serviceDue: MineCareServiceDue | null
  serviceSchedule: Array<{
    _id: string
    equipmentType: string
    serviceName: string
    intervalHours: number
    requiredParts: string[]
    estimatedCost: number
  }>
  health: MineCareHealth
  maintenanceHistory: Array<Record<string, unknown>>
  breakdownHistory: Array<Record<string, unknown>>
  observations: MineCareObservation[]
  documents?: MineCareKnowledgeDocument[]
  lifecycleTimeline: Array<{ label: string; date: string; detail: string }>
  healthTimeline?: Array<{ date: string; title: string; type: string; severity: string; description: string; source: string }>
  assetAiSummary?: string
  nextBestAction?: string
  lifecycleRiskNarrative?: string
  lifecycleTracker: {
    purchaseDate: string
    currentAge: string
    warrantyStatus: string
    expectedLife: string
    replacementYear: number
  }
}

export interface MineCareWarrantyClaim {
  id?: string
  equipmentId: string
  equipmentName: string
  breakdownId: string
  failureType: string
  breakdownDate: string
  potentialClaim: boolean
  status?: 'Potential' | 'Submitted' | 'Approved' | 'Rejected'
  recoverableCost: number
  recommendation: string
  claimProbability?: number
  missingDocuments?: string[]
  aiExplanation?: string
}

export interface MineCareCopilotResponse {
  answer: string
  recommendedActions: MineCareAction[]
  referencedAssets: string[]
  confidence: number
  source?: string
  data?: unknown
}

export interface MineCareExecutiveReport {
  period: string
  generatedAt: string
  summary: Record<string, number>
  criticalAssets: MineCareRisk[]
  upcomingServices: MineCareServiceDue[]
  warrantyAlerts: MineCareAlert[]
  warrantyClaimOpportunities?: MineCareWarrantyClaim[]
  sparePartRequirements: MineCareSparePart[]
  budgetForecast: MineCareBudgetForecast
  rootCauseHighlights?: MineCareRootCauseAnalysis[]
  repairReplaceHighlights?: MineCareRepairReplaceAnalysis[]
  procurementInsights?: MineCareProcurementComparison[]
  maintenanceHistoryHighlights?: MineCareMaintenanceRecord[]
  breakdownHighlights?: MineCareBreakdownRecord[]
  operatorObservationHighlights?: MineCareObservation[]
  aiRecommendations?: MineCareRecommendation[]
  savings?: MineCareSavings
  recommendedActions: MineCareAction[]
}

export interface MineCareDocumentExtractionResponse {
  equipment: Partial<MineCareEquipment>
  warranty: Partial<MineCareWarranty>
  serviceSchedules: Array<{
    equipmentType?: string
    serviceName?: string
    intervalHours?: number
    requiredParts?: string[]
    estimatedCost?: number
  }>
  aiExtractionSummary: string
  confidence: number
  missingFields: string[]
  sourceDocuments: string[]
  rawExtractedTextPreview: string
  onboardingSummary?: string
  warrantyInsight?: string
  recommendedFirstService?: string
  suggestedSpareKit?: string[]
  suggestedCriticality?: MineCareCriticality
  extractedFieldsCount?: number
  fieldConfidenceMap?: Record<string, number>
}

export type MineCareEquipmentPayload = Omit<MineCareEquipment, '_id' | 'created' | 'updated' | 'warranty' | 'serviceSchedule'> & {
  warranty?: Partial<MineCareWarranty>
  serviceSchedules?: Array<{
    equipmentType?: string
    serviceName?: string
    intervalHours?: number
    requiredParts?: string[]
    estimatedCost?: number
  }>
}

export interface MineCareRootCauseAnalysis {
  _id?: string
  analysisId: string
  equipmentId: string
  equipmentName: string
  failureType: string
  component?: string
  problem: string
  likelyRootCauses: string[]
  evidence: string[]
  recommendedActions: string[]
  causeConfidence?: Array<{ cause: string; confidence: number }>
  preventiveControls?: string[]
  evidenceSummary?: string
  confidence: number
  aiProvider?: string
  status: string
  created?: string
  updated?: string
}

export interface MineCareChecklistItem {
  itemId: string
  step: number
  task: string
  safetyNote?: string
  requiredPart?: string
  estimatedTimeMinutes?: number
  completed: boolean
}

export interface MineCareChecklist {
  _id?: string
  checklistId: string
  equipmentId: string
  equipmentName: string
  serviceType: string
  checklistTitle: string
  items: MineCareChecklistItem[]
  safetyPrecautions: string[]
  requiredTools: string[]
  requiredParts: string[]
  skillRequirement?: string
  qualityGate?: string
  aiPreparationNotes?: string[]
  confidence: number
  status: string
  progressPercent?: number
  completedItems?: number
  totalItems?: number
  checklistStatus?: string
  created?: string
  updated?: string
}

export interface MineCareKnowledgeDocument {
  _id?: string
  documentId: string
  fileName: string
  originalName: string
  documentType: string
  equipmentId?: string
  equipmentType?: string
  uploadSource?: string
  fileUrl?: string
  mimeType?: string
  fileSize?: number
  uploadedAt: string
  extractedTextPreview?: string
  chunkCount: number
  status: string
  errorMessage?: string
}

export interface MineCareKnowledgeAnswer {
  answer: string
  citations: Array<{ documentId: string; documentName: string; section?: string; pageNumber?: number; chunkIndex?: number; snippet?: string; confidence?: number }>
  sources?: Array<{ documentId?: string; documentName: string; section?: string; pageNumber?: number; chunkIndex?: number; snippet?: string; confidence?: number }>
  recommendedActions?: string[]
  confidence: number
  aiProvider?: string
}

export interface MineCareVendorSla {
  _id?: string
  slaId: string
  vendorName: string
  contractType: string
  equipmentIds: string[]
  serviceFrequencyDays: number
  committedResponseHours: number
  actualResponseHours: number
  plannedServiceDate?: string
  actualServiceDate?: string
  missedServiceCount: number
  slaCompliancePercent: number
  penaltyAmount: number
  status: string
}

export interface MineCareVendorSlaScorecard {
  totalVendors: number
  activeContracts: number
  atRiskContracts: number
  totalPenaltyExposure: number
  vendors: Array<{ vendorName: string; status: string; compliance: number; penaltyAmount: number; missedServiceCount: number }>
}

export interface MineCareRepairReplaceAnalysis {
  _id?: string
  analysisId: string
  equipmentId: string
  equipmentName: string
  recommendation: string
  reason: string
  repairCostRatio: number
  estimatedReplacementYear: number
  financialImpact: {
    repairOptionCost: number
    replacementOptionCost: number
    downtimeRisk: number
    projectedSavings: number
  }
  recommendedActions: string[]
  confidence: number
  decisionFactors?: string[]
  paybackEstimate?: string
}

export interface MineCareDowntimeScenario {
  _id?: string
  scenarioId: string
  equipmentId: string
  equipmentName: string
  expectedDowntimeHours: number
  productionLossPerHour: number
  dependentProcesses: string[]
  failureProbability: number
  repairDelayDays: number
  productionLoss: number
  riskLevel: string
  recommendedAction: string
  recoveryPlan?: string[]
  mitigationOptions?: string[]
  impactExplanation?: string
}

export interface MineCareTechnician {
  _id?: string
  technicianId: string
  technicianName: string
  employeeId: string
  skills: string[]
  equipmentTypes: string[]
  issueTypes: string[]
  availabilityStatus: 'Available' | 'Busy' | 'On Leave'
  averageResolutionHours: number
  successRate: number
  completedJobs: number
  location: string
  matchScore?: number
  reason?: string
  aiExplanation?: string
  skillGap?: string[]
  trainingSuggestion?: string
}

export interface MineCareProcurementOption {
  _id?: string
  optionId: string
  name: string
  equipmentType: string
  vendor: string
  purchaseCost: number
  warrantyYears: number
  expectedMaintenanceCost: number
  fuelCost: number
  expectedLifeYears: number
  resaleValue: number
  downtimeRiskCost: number
  notes?: string
}

export interface MineCareProcurementComparison {
  _id?: string
  comparisonId: string
  selectedOptionIds: string[]
  bestOption: string
  reason: string
  comparison: Array<{ optionId: string; name: string; fiveYearTco: number }>
  recommendedActions: string[]
  confidence: number
  vendorRiskSummary?: string
  negotiationPoints?: string[]
  decisionFactors?: string[]
}

export interface MineCareSavings {
  estimatedDowntimeAvoided: number
  warrantyRecoveryOpportunity: number
  preventiveMaintenanceSavings: number
  sparePartsOptimizationSavings: number
  repairReplaceSavings: number
  totalEstimatedSavings: number
}

export interface MineCareRecommendation {
  _id?: string
  recommendationId: string
  equipmentId?: string
  equipmentName?: string
  recommendationType: string
  title: string
  reason: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  recommendedAction: string
  estimatedImpact: string
  estimatedSavings: number
  source: 'Service' | 'Warranty' | 'Risk' | 'Spare' | 'Root Cause' | 'Checklist' | 'Budget' | 'AI' | 'Vendor' | 'Procurement'
  confidence: number
  status: 'Open' | 'In Progress' | 'Completed' | 'Dismissed'
  createdAt?: string
  updatedAt?: string
  created?: string
  updated?: string
}
