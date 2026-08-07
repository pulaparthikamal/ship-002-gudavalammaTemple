import { z } from 'zod';

const optionalString = z.string().trim().optional();
const optionalNumber = z.coerce.number().optional();
const optionalDate = z.coerce.date().optional();

const warrantySchema = z.object({
  startDate: optionalDate,
  endDate: optionalDate,
  hourLimit: optionalNumber,
  coveredComponents: z.array(z.string().trim()).optional(),
  terms: optionalString,
}).optional();

const serviceScheduleSchema = z.object({
  equipmentType: optionalString,
  serviceName: optionalString,
  intervalHours: optionalNumber,
  requiredParts: z.array(z.string().trim()).optional(),
  estimatedCost: optionalNumber,
});

export const createEquipmentSchema = z.object({
  body: z.object({
    equipmentId: optionalString,
    name: optionalString,
    type: optionalString,
    brand: optionalString,
    model: optionalString,
    serialNumber: optionalString,
    location: optionalString,
    department: optionalString,
    purchaseDate: optionalDate,
    invoiceValue: optionalNumber,
    vendor: optionalString,
    currentRunningHours: optionalNumber,
    averageDailyUsage: optionalNumber,
    status: optionalString,
    criticality: optionalString,
    warranty: warrantySchema,
    serviceSchedules: z.array(serviceScheduleSchema).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateEquipmentSchema = z.object({
  body: createEquipmentSchema.shape.body.partial(),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const idParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const createObservationSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    observationDate: optionalDate,
    observationType: z.string().trim().min(1),
    description: z.string().trim().min(1),
    severity: z.string().trim().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const completeServiceSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    serviceName: z.string().trim().min(1),
    serviceDate: optionalDate,
    runningHours: optionalNumber,
    actionTaken: optionalString,
    technician: optionalString,
    cost: optionalNumber,
    downtimeHours: optionalNumber,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const recordBreakdownRepairSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    breakdownDate: optionalDate,
    failureType: z.string().trim().min(1),
    component: optionalString,
    rootCause: optionalString,
    repairCost: optionalNumber,
    downtimeHours: optionalNumber,
    warrantyClaimRaised: z.boolean().optional(),
    createMaintenanceRecord: z.boolean().optional(),
    technician: optionalString,
    actionTaken: optionalString,
    runningHours: optionalNumber,
    repaired: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const copilotSchema = z.object({
  body: z.object({
    question: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const alertStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Open', 'Acknowledged', 'Closed']),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const actionStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Open', 'In Progress', 'Completed']),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const recommendationStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Open', 'In Progress', 'Completed', 'Dismissed']),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const warrantyClaimStatusSchema = z.object({
  body: z.object({
    status: z.enum(['Potential', 'Submitted', 'Approved', 'Rejected']),
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().trim().min(1),
  }),
});

export const executiveReportSchema = z.object({
  body: z.object({
    period: z.enum(['weekly', 'monthly']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const stringArray = z.union([z.array(z.string().trim()), z.string().trim()]).optional();

export const rootCauseAnalyzeSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    equipmentName: optionalString,
    failureType: z.string().trim().min(1),
    component: optionalString,
    problem: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const checklistGenerateSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    equipmentName: optionalString,
    serviceType: optionalString,
    checklistTitle: optionalString,
    requiredParts: stringArray,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const checklistUpdateSchema = z.object({
  body: z.object({
    checklistTitle: optionalString,
    serviceType: optionalString,
    status: z.enum(['Draft', 'Active', 'Completed']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().trim().min(1) }),
});

export const checklistItemSchema = z.object({
  body: z.object({ completed: z.coerce.boolean() }),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().trim().min(1), itemId: z.string().trim().min(1) }),
});

export const knowledgeAskSchema = z.object({
  body: z.object({ question: z.string().trim().min(1) }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const vendorSlaSchema = z.object({
  body: z.object({
    slaId: optionalString,
    vendorName: z.string().trim().min(1),
    contractType: optionalString,
    equipmentIds: stringArray,
    serviceFrequencyDays: optionalNumber,
    committedResponseHours: optionalNumber,
    actualResponseHours: optionalNumber,
    plannedServiceDate: optionalDate,
    actualServiceDate: optionalDate,
    missedServiceCount: optionalNumber,
    slaCompliancePercent: optionalNumber,
    penaltyAmount: optionalNumber,
    status: z.enum(['Active', 'At Risk', 'Breached', 'Closed']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateVendorSlaSchema = z.object({
  body: vendorSlaSchema.shape.body.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().trim().min(1) }),
});

export const repairReplaceAnalyzeSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    equipmentName: optionalString,
    repairCost: optionalNumber,
    replacementCost: optionalNumber,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const downtimeSimulateSchema = z.object({
  body: z.object({
    equipmentId: z.string().trim().min(1),
    equipmentName: optionalString,
    expectedDowntimeHours: optionalNumber,
    productionLossPerHour: optionalNumber,
    dependentProcesses: stringArray,
    failureProbability: optionalNumber,
    repairDelayDays: optionalNumber,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const technicianSchema = z.object({
  body: z.object({
    technicianId: optionalString,
    technicianName: z.string().trim().min(1),
    employeeId: optionalString,
    skills: stringArray,
    equipmentTypes: stringArray,
    issueTypes: stringArray,
    availabilityStatus: z.enum(['Available', 'Busy', 'On Leave']).optional(),
    averageResolutionHours: optionalNumber,
    successRate: optionalNumber,
    completedJobs: optionalNumber,
    location: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateTechnicianSchema = z.object({
  body: technicianSchema.shape.body.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().trim().min(1) }),
});

export const technicianRecommendSchema = z.object({
  body: z.object({
    issueType: z.string().trim().min(1),
    equipmentType: z.string().trim().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const procurementOptionSchema = z.object({
  body: z.object({
    optionId: optionalString,
    name: z.string().trim().min(1),
    equipmentType: z.string().trim().min(1),
    vendor: optionalString,
    purchaseCost: optionalNumber,
    warrantyYears: optionalNumber,
    expectedMaintenanceCost: optionalNumber,
    fuelCost: optionalNumber,
    expectedLifeYears: optionalNumber,
    resaleValue: optionalNumber,
    downtimeRiskCost: optionalNumber,
    notes: optionalString,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProcurementOptionSchema = z.object({
  body: procurementOptionSchema.shape.body.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.string().trim().min(1) }),
});

export const procurementCompareSchema = z.object({
  body: z.object({
    optionIds: z.array(z.string().trim()).min(1).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
