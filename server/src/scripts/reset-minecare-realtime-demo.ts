import 'dotenv/config';
import mongoose, { Model } from 'mongoose';
import {
  MineCareActionStatus,
  MineCareAlertStatus,
  MineCareBreakdownRecord,
  MineCareChecklist,
  MineCareDowntimeScenario,
  MineCareEquipment,
  MineCareKnowledgeChunk,
  MineCareKnowledgeDocument,
  MineCareMaintenanceHistory,
  MineCareOperatorObservation,
  MineCareProcurementComparison,
  MineCareProcurementOption,
  MineCareRecommendation,
  MineCareRepairReplaceAnalysis,
  MineCareReportHistory,
  MineCareRootCauseAnalysis,
  MineCareServiceSchedule,
  MineCareSparePart,
  MineCareTechnician,
  MineCareVendorSla,
  MineCareWarranty,
  MineCareWarrantyClaimStatus,
} from '../modules/mineCareAi/mineCareAi.model';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp_db';
const now = new Date();
const dayMs = 24 * 60 * 60 * 1000;

const daysFromNow = (days: number) => new Date(now.getTime() + days * dayMs);
const daysAgo = (days: number) => daysFromNow(-days);

const activeRecord = {
  active: true,
  isDeleted: false,
};

const mineCareModels: Array<[string, Model<any>]> = [
  ['Action Status', MineCareActionStatus],
  ['Alert Status', MineCareAlertStatus],
  ['Breakdown Record', MineCareBreakdownRecord],
  ['Checklist', MineCareChecklist],
  ['Downtime Scenario', MineCareDowntimeScenario],
  ['Equipment', MineCareEquipment],
  ['Knowledge Chunk', MineCareKnowledgeChunk],
  ['Knowledge Document', MineCareKnowledgeDocument],
  ['Maintenance History', MineCareMaintenanceHistory],
  ['Operator Observation', MineCareOperatorObservation],
  ['Procurement Comparison', MineCareProcurementComparison],
  ['Procurement Option', MineCareProcurementOption],
  ['Recommendation', MineCareRecommendation],
  ['Repair Replace Analysis', MineCareRepairReplaceAnalysis],
  ['Report History', MineCareReportHistory],
  ['Root Cause Analysis', MineCareRootCauseAnalysis],
  ['Service Schedule', MineCareServiceSchedule],
  ['Spare Part', MineCareSparePart],
  ['Technician', MineCareTechnician],
  ['Vendor SLA', MineCareVendorSla],
  ['Warranty', MineCareWarranty],
  ['Warranty Claim Status', MineCareWarrantyClaimStatus],
];

async function clearMineCareData() {
  for (const [name, model] of mineCareModels) {
    const result = await model.deleteMany({});
    console.log(`Cleared ${result.deletedCount} ${name} records`);
  }
}

async function seedMineCareData() {
  const equipment = [
    {
      equipmentId: 'EXC-210',
      name: 'CAT 390F Hydraulic Excavator',
      type: 'Excavator',
      brand: 'Caterpillar',
      modelName: '390F L',
      serialNumber: 'CAT390F-IND-21092',
      location: 'North Pit - Bench 4',
      department: 'Mining Operations',
      purchaseDate: daysAgo(1640),
      invoiceValue: 1125000,
      vendor: 'Caterpillar India',
      currentRunningHours: 18420,
      averageDailyUsage: 18,
      status: 'Operational',
      criticality: 'Critical',
      created: daysAgo(180),
      updated: daysAgo(1),
      ...activeRecord,
    },
    {
      equipmentId: 'DT-118',
      name: 'Komatsu HD785 Dump Truck',
      type: 'Dump Truck',
      brand: 'Komatsu',
      modelName: 'HD785-7',
      serialNumber: 'KMT-HD785-1187',
      location: 'Haul Road 2',
      department: 'Haulage',
      purchaseDate: daysAgo(1960),
      invoiceValue: 785000,
      vendor: 'Komatsu Mining',
      currentRunningHours: 22680,
      averageDailyUsage: 20,
      status: 'Under Maintenance',
      criticality: 'High',
      created: daysAgo(175),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      equipmentId: 'CR-044',
      name: 'Metso HP500 Cone Crusher',
      type: 'Crusher',
      brand: 'Metso',
      modelName: 'HP500',
      serialNumber: 'MET-HP500-4401',
      location: 'Primary Crushing Plant',
      department: 'Processing',
      purchaseDate: daysAgo(2360),
      invoiceValue: 940000,
      vendor: 'Metso Outotec',
      currentRunningHours: 31240,
      averageDailyUsage: 21,
      status: 'Operational',
      criticality: 'Critical',
      created: daysAgo(170),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      equipmentId: 'CV-072',
      name: 'Fenner Conveyor CV-072',
      type: 'Conveyor',
      brand: 'Fenner Dunlop',
      modelName: 'ST2500',
      serialNumber: 'FD-CV072-9182',
      location: 'Stockpile Transfer',
      department: 'Material Handling',
      purchaseDate: daysAgo(1280),
      invoiceValue: 320000,
      vendor: 'Fenner Conveyors',
      currentRunningHours: 14600,
      averageDailyUsage: 19,
      status: 'Operational',
      criticality: 'High',
      created: daysAgo(160),
      updated: daysAgo(2),
      ...activeRecord,
    },
    {
      equipmentId: 'DR-031',
      name: 'Epiroc Pit Viper Drill',
      type: 'Drill',
      brand: 'Epiroc',
      modelName: 'PV-271',
      serialNumber: 'EPI-PV271-0315',
      location: 'South Pit - Blast Pattern S12',
      department: 'Drilling',
      purchaseDate: daysAgo(920),
      invoiceValue: 675000,
      vendor: 'Epiroc Mining',
      currentRunningHours: 9820,
      averageDailyUsage: 15,
      status: 'Operational',
      criticality: 'High',
      created: daysAgo(145),
      updated: daysAgo(1),
      ...activeRecord,
    },
    {
      equipmentId: 'LD-014',
      name: 'Volvo L350H Wheel Loader',
      type: 'Loader',
      brand: 'Volvo',
      modelName: 'L350H',
      serialNumber: 'VOL-L350H-0148',
      location: 'ROM Pad',
      department: 'Loading',
      purchaseDate: daysAgo(760),
      invoiceValue: 515000,
      vendor: 'Volvo CE',
      currentRunningHours: 7840,
      averageDailyUsage: 13,
      status: 'Operational',
      criticality: 'Medium',
      created: daysAgo(130),
      updated: daysAgo(3),
      ...activeRecord,
    },
    {
      equipmentId: 'PMP-09',
      name: 'Weir Warman Slurry Pump',
      type: 'Pump',
      brand: 'Weir Minerals',
      modelName: 'Warman MCR 450',
      serialNumber: 'WEIR-MCR450-009',
      location: 'Tailings Pump House',
      department: 'Processing',
      purchaseDate: daysAgo(1480),
      invoiceValue: 185000,
      vendor: 'Weir Minerals',
      currentRunningHours: 20250,
      averageDailyUsage: 22,
      status: 'Breakdown',
      criticality: 'Critical',
      created: daysAgo(120),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      equipmentId: 'GEN-05',
      name: 'CAT C175 Backup Generator',
      type: 'Generator',
      brand: 'Caterpillar',
      modelName: 'C175-16',
      serialNumber: 'CAT-C175-0503',
      location: 'Plant Substation',
      department: 'Utilities',
      purchaseDate: daysAgo(1180),
      invoiceValue: 420000,
      vendor: 'Caterpillar India',
      currentRunningHours: 6320,
      averageDailyUsage: 5,
      status: 'Operational',
      criticality: 'High',
      created: daysAgo(110),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const warranties = [
    ['EXC-210', daysAgo(1640), daysFromNow(185), 24000, ['Hydraulic pump', 'Boom cylinders', 'Swing motor'], 'Extended powertrain and hydraulic coverage', 'Expiring Soon'],
    ['DT-118', daysAgo(1960), daysAgo(25), 22000, ['Final drive', 'Transmission'], 'Standard OEM warranty expired, claim requires goodwill approval', 'Expired'],
    ['CR-044', daysAgo(2360), daysFromNow(58), 34000, ['Main shaft', 'Lubrication unit', 'Hydraulic tramp release'], 'Crusher critical components covered for manufacturing defects', 'Expiring Soon'],
    ['CV-072', daysAgo(1280), daysFromNow(420), 18000, ['Belt joints', 'Drive pulley', 'Gearbox'], 'Conveyor drive package coverage', 'Active'],
    ['DR-031', daysAgo(920), daysFromNow(510), 15000, ['Rotary head', 'Compressor', 'Feed motor'], 'Full machine warranty with quarterly OEM inspection', 'Active'],
    ['LD-014', daysAgo(760), daysFromNow(640), 12000, ['Transmission', 'Axles', 'Hydraulic valves'], 'Loader drivetrain and hydraulic coverage', 'Active'],
    ['PMP-09', daysAgo(1480), daysFromNow(32), 24000, ['Impeller', 'Liner', 'Bearing assembly'], 'Wear part warranty subject to slurry density limits', 'Expiring Soon'],
    ['GEN-05', daysAgo(1180), daysFromNow(260), 9000, ['Alternator', 'ECM', 'Fuel injectors'], 'Generator standby warranty', 'Active'],
  ].map(([equipmentId, startDate, endDate, hourLimit, coveredComponents, terms, status]) => ({
    equipmentId,
    startDate,
    endDate,
    hourLimit,
    coveredComponents,
    terms,
    status,
    created: daysAgo(90),
    updated: daysAgo(1),
    ...activeRecord,
  }));

  const serviceSchedules = [
    ['EXC-210', 'Excavator', 'Hydraulic oil and filter service', 500, ['HYD-FLT-390', 'ENG-OIL-15W40'], 8200],
    ['EXC-210', 'Excavator', 'Undercarriage inspection', 250, ['TRACK-PIN-KIT'], 5400],
    ['DT-118', 'Dump Truck', 'Transmission pressure inspection', 400, ['TRANS-FLT-HD785'], 6900],
    ['DT-118', 'Dump Truck', 'Brake cooling system service', 500, ['BRAKE-SEAL-HD785'], 7800],
    ['CR-044', 'Crusher', 'Cone liner inspection', 300, ['CONE-LINER-HP500'], 18500],
    ['CR-044', 'Crusher', 'Lube oil analysis and filter change', 250, ['LUBE-FLT-HP500'], 6400],
    ['CV-072', 'Conveyor', 'Belt joint and pulley inspection', 350, ['BELT-JOINT-ST2500'], 4200],
    ['DR-031', 'Drill', 'Compressor service', 500, ['COMP-FLT-PV271'], 7600],
    ['LD-014', 'Loader', 'Hydraulic valve calibration', 450, ['HYD-FLT-L350H'], 5600],
    ['PMP-09', 'Pump', 'Impeller and liner inspection', 300, ['IMP-MCR450', 'LINER-MCR450'], 9200],
    ['PMP-09', 'Pump', 'Bearing temperature inspection', 150, ['BRG-MCR450'], 3800],
    ['GEN-05', 'Generator', 'Load bank and fuel system test', 250, ['FUEL-FLT-C175'], 4800],
  ].map(([equipmentId, equipmentType, serviceName, intervalHours, requiredParts, estimatedCost], index) => ({
    equipmentId,
    equipmentType,
    serviceName,
    intervalHours,
    requiredParts,
    estimatedCost,
    created: daysAgo(60 + index),
    updated: daysAgo(index % 3),
    ...activeRecord,
  }));

  const maintenanceHistory = [
    ['EXC-210', 8, '500 hour service', 18120, 'Changed hydraulic filters, sampled oil, tightened boom pins', 'Ravi Kumar', 9400, 4],
    ['EXC-210', 41, 'Corrective repair', 17490, 'Replaced seepage seal on boom cylinder', 'Anil Reddy', 18200, 6],
    ['DT-118', 3, 'Breakdown repair', 22680, 'Diagnosed transmission pressure drop and parked for service', 'Pooja Sharma', 12400, 10],
    ['DT-118', 35, 'Preventive service', 22140, 'Brake cooling inspection and differential oil top-up', 'Naveen Patil', 7600, 3],
    ['CR-044', 5, 'Lube service', 31135, 'Changed lube filters and verified return line flow', 'Sanjay Rao', 8800, 5],
    ['CR-044', 24, 'Inspection', 30720, 'Measured cone liner wear and adjusted CSS', 'Amit Singh', 5200, 3],
    ['CV-072', 6, 'Inspection', 14505, 'Repaired belt scraper and aligned tail pulley', 'Manoj Das', 4100, 2],
    ['CV-072', 47, 'Corrective repair', 13730, 'Replaced lagging on drive pulley', 'Ravi Kumar', 21800, 7],
    ['DR-031', 10, 'Compressor service', 9710, 'Changed compressor filter and checked oil carryover', 'Pooja Sharma', 9100, 4],
    ['LD-014', 12, 'Hydraulic inspection', 7770, 'Calibrated hydraulic valves and checked lift cylinder drift', 'Anil Reddy', 6600, 3],
    ['PMP-09', 1, 'Emergency repair', 20250, 'Opened pump casing after high vibration trip', 'Sanjay Rao', 27600, 12],
    ['PMP-09', 19, 'Wear inspection', 19890, 'Measured impeller wear and slurry leakage at gland', 'Manoj Das', 11400, 5],
    ['GEN-05', 4, 'Load test', 6310, 'Completed load bank test and replaced fuel filters', 'Naveen Patil', 7200, 3],
  ].map(([equipmentId, days, serviceType, runningHours, actionTaken, technician, cost, downtimeHours]) => ({
    equipmentId,
    serviceDate: daysAgo(Number(days)),
    serviceType,
    runningHours,
    actionTaken,
    technician,
    cost,
    downtimeHours,
    created: daysAgo(Number(days)),
    updated: daysAgo(Math.max(0, Number(days) - 1)),
    ...activeRecord,
  }));

  const breakdownRecords = [
    ['PMP-09', 1, 'Seal failure', 'Gland seal', 'Slurry ingress caused seal overheating and vibration trip', 27600, 12, true],
    ['DT-118', 3, 'Transmission pressure loss', 'Transmission', 'Filter restriction and elevated oil temperature caused derate', 12400, 10, false],
    ['CR-044', 16, 'Lubrication pressure dip', 'Lube pump', 'Intermittent pump cavitation during startup', 9800, 5, true],
    ['EXC-210', 41, 'Hydraulic leak', 'Boom cylinder', 'Rod seal wear detected during inspection', 18200, 6, true],
    ['CV-072', 47, 'Belt slip', 'Drive pulley', 'Lagging wear reduced traction during wet feed conditions', 21800, 7, false],
    ['DR-031', 64, 'Compressor high temperature', 'Compressor', 'Dust loading in intake filter increased outlet temperature', 14600, 8, true],
  ].map(([equipmentId, days, failureType, component, rootCause, repairCost, downtimeHours, warrantyClaimRaised]) => ({
    equipmentId,
    breakdownDate: daysAgo(Number(days)),
    failureType,
    component,
    rootCause,
    repairCost,
    downtimeHours,
    warrantyClaimRaised,
    created: daysAgo(Number(days)),
    updated: daysAgo(Math.max(0, Number(days) - 1)),
    ...activeRecord,
  }));

  const observations = [
    ['PMP-09', 0, 'Vibration', 'High vibration after restart, pump casing temperature rising above normal trend', 'Critical'],
    ['DT-118', 1, 'Temperature', 'Transmission temperature crossed normal band during loaded uphill haul', 'High'],
    ['CR-044', 2, 'Noise', 'Intermittent knocking sound from crusher head at high feed rate', 'High'],
    ['EXC-210', 3, 'Hydraulic', 'Minor oil mist near boom cylinder after long digging cycle', 'Medium'],
    ['CV-072', 4, 'Belt tracking', 'Belt drifting 40 mm toward walkway side near transfer chute', 'Medium'],
    ['DR-031', 5, 'Air pressure', 'Compressor recovery time longer than previous shift', 'Medium'],
    ['LD-014', 7, 'Steering', 'Steering response feels delayed during bucket carry', 'Low'],
    ['GEN-05', 9, 'Fuel', 'Fuel differential pressure nearing warning limit', 'Medium'],
    ['CR-044', 11, 'Lubrication', 'Lube oil return flow briefly unstable after cold start', 'High'],
    ['CV-072', 14, 'Carryback', 'Increased carryback below secondary scraper', 'Low'],
  ].map(([equipmentId, days, observationType, description, severity]) => ({
    equipmentId,
    observationDate: daysAgo(Number(days)),
    observationType,
    description,
    severity,
    created: daysAgo(Number(days)),
    updated: daysAgo(Math.max(0, Number(days) - 1)),
    ...activeRecord,
  }));

  const spareParts = [
    ['HYD-FLT-390', 'Excavator hydraulic filter kit', 6, 8, 5, 420, ['Excavator']],
    ['ENG-OIL-15W40', 'Heavy duty engine oil drum 15W40', 18, 12, 3, 315, ['Excavator', 'Dump Truck', 'Loader']],
    ['TRACK-PIN-KIT', 'Excavator track pin kit', 2, 4, 14, 1850, ['Excavator']],
    ['TRANS-FLT-HD785', 'HD785 transmission filter kit', 3, 5, 7, 760, ['Dump Truck']],
    ['BRAKE-SEAL-HD785', 'HD785 brake seal kit', 4, 4, 10, 980, ['Dump Truck']],
    ['CONE-LINER-HP500', 'HP500 cone liner set', 1, 2, 21, 12800, ['Crusher']],
    ['LUBE-FLT-HP500', 'HP500 lube filter', 5, 6, 6, 540, ['Crusher']],
    ['BELT-JOINT-ST2500', 'ST2500 conveyor belt joint kit', 2, 3, 12, 2400, ['Conveyor']],
    ['COMP-FLT-PV271', 'Pit Viper compressor filter', 4, 4, 8, 690, ['Drill']],
    ['HYD-FLT-L350H', 'L350H hydraulic filter', 7, 5, 5, 480, ['Loader']],
    ['IMP-MCR450', 'Warman MCR450 impeller', 1, 2, 18, 6200, ['Pump']],
    ['LINER-MCR450', 'Warman MCR450 liner set', 0, 2, 20, 7200, ['Pump']],
    ['BRG-MCR450', 'Warman MCR450 bearing assembly', 2, 2, 14, 3600, ['Pump']],
    ['FUEL-FLT-C175', 'C175 fuel filter set', 6, 4, 4, 390, ['Generator']],
  ].map(([partNumber, partName, currentStock, minimumStock, leadTimeDays, unitCost, compatibleEquipmentTypes], index) => ({
    partNumber,
    partName,
    currentStock,
    minimumStock,
    leadTimeDays,
    unitCost,
    compatibleEquipmentTypes,
    created: daysAgo(100 + index),
    updated: daysAgo(index % 4),
    ...activeRecord,
  }));

  const alerts = [
    ['ALT-PMP-09-001', 'PMP-09', 'Breakdown', 'Pump vibration critical', 'PMP-09 has a current vibration trip and needs immediate repair closure.', 'Critical', 'Open', 'Operator Observation'],
    ['ALT-DT-118-002', 'DT-118', 'Service Due', 'Transmission service overdue', 'Transmission service is due based on running hours and recent temperature trend.', 'High', 'Acknowledged', 'Service Prediction'],
    ['ALT-CR-044-003', 'CR-044', 'Warranty', 'Crusher warranty expiring soon', 'HP500 warranty expires within the current planning window.', 'High', 'Open', 'Warranty Tracker'],
    ['ALT-SPARE-004', 'PMP-09', 'Spare Shortage', 'Pump liner shortage', 'MCR450 liner stock is below minimum for upcoming repairs.', 'Critical', 'Open', 'Spare Planner'],
  ].map(([alertId, equipmentId, alertType, title, message, severity, status, source]) => ({
    alertId,
    equipmentId,
    alertType,
    title,
    message,
    severity,
    status,
    source,
    created: daysAgo(alertId === 'ALT-PMP-09-001' ? 0 : 2),
    updated: daysAgo(0),
    ...activeRecord,
  }));

  const actions = [
    ['ACT-PMP-09-001', 'PMP-09', 'Critical', 'Replace MCR450 liner and inspect impeller clearance', 'Pump is down and liner stock is below threshold', 'In Progress'],
    ['ACT-DT-118-002', 'DT-118', 'High', 'Complete transmission filter service and oil analysis', 'Recent derate and temperature observation indicate service risk', 'Open'],
    ['ACT-CR-044-003', 'CR-044', 'High', 'Raise warranty review for lube pump pressure event', 'Failure happened before warranty expiry and has claim potential', 'Open'],
    ['ACT-CV-072-004', 'CV-072', 'Medium', 'Schedule belt tracking correction during next shift change', 'Operator reported belt drift and carryback', 'Completed'],
  ].map(([actionId, equipmentId, priority, action, reason, status]) => ({
    actionId,
    equipmentId,
    priority,
    action,
    reason,
    status,
    created: daysAgo(actionId === 'ACT-PMP-09-001' ? 0 : 4),
    updated: daysAgo(0),
    ...activeRecord,
  }));

  const warrantyClaims = [
    ['CLM-PMP-09-001', 'PMP-09', 'Gland seal', 'Seal failure', 18600, 'Potential', 'Prepare claim packet with vibration trend, maintenance record, and slurry density log.'],
    ['CLM-CR-044-002', 'CR-044', 'Lube pump', 'Lubrication pressure dip', 9800, 'Submitted', 'Follow up with OEM because event occurred before warranty expiry.'],
    ['CLM-EXC-210-003', 'EXC-210', 'Boom cylinder', 'Hydraulic leak', 14200, 'Approved', 'Approved under hydraulic cylinder extended coverage.'],
  ].map(([claimId, equipmentId, component, failureType, recoverableCost, status, recommendation]) => ({
    claimId,
    equipmentId,
    component,
    failureType,
    recoverableCost,
    status,
    recommendation,
    created: daysAgo(10),
    updated: daysAgo(1),
    ...activeRecord,
  }));

  const rootCauseAnalyses = [
    {
      analysisId: 'RCA-PMP-09-001',
      equipmentId: 'PMP-09',
      equipmentName: 'Weir Warman Slurry Pump',
      failureType: 'Seal failure',
      component: 'Gland seal',
      problem: 'High vibration trip after restart with casing temperature above normal trend.',
      likelyRootCauses: ['Liner wear increased internal recirculation', 'Seal flush flow below required pressure', 'Bearing assembly exposed to slurry ingress'],
      evidence: ['Operator observation logged today', 'Maintenance history shows wear inspection 19 days ago', 'MCR450 liner stock is zero'],
      recommendedActions: ['Replace liner and gland seal', 'Verify seal flush pressure before restart', 'Inspect bearing assembly for slurry contamination'],
      causeConfidence: [
        { cause: 'Liner wear increased internal recirculation', confidence: 86 },
        { cause: 'Seal flush flow below required pressure', confidence: 78 },
      ],
      preventiveControls: ['Add weekly seal flush pressure check', 'Trigger liner reorder at two units on hand'],
      evidenceSummary: 'Recent vibration, prior wear inspection, and stockout point to wear-driven seal failure risk.',
      confidence: 84,
      aiProvider: 'seeded-ai-demo',
      status: 'Reviewed',
      created: daysAgo(0),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      analysisId: 'RCA-DT-118-002',
      equipmentId: 'DT-118',
      equipmentName: 'Komatsu HD785 Dump Truck',
      failureType: 'Transmission pressure loss',
      component: 'Transmission',
      problem: 'Truck derated on uphill haul with elevated transmission temperature.',
      likelyRootCauses: ['Transmission filter restriction', 'Cooling circuit efficiency drop', 'Oil degradation after heavy haul cycles'],
      evidence: ['Recent observation reported temperature crossing normal band', 'Current hours exceed service interval', 'Truck is already under maintenance'],
      recommendedActions: ['Replace transmission filters', 'Run oil analysis', 'Check cooling circuit restriction'],
      causeConfidence: [
        { cause: 'Transmission filter restriction', confidence: 81 },
        { cause: 'Cooling circuit efficiency drop', confidence: 68 },
      ],
      preventiveControls: ['Shorten oil sampling interval for high-load haul trucks'],
      evidenceSummary: 'Service interval overrun plus heat trend indicates pressure loss from restriction or cooling loss.',
      confidence: 79,
      aiProvider: 'seeded-ai-demo',
      status: 'Draft',
      created: daysAgo(2),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const checklists = [
    {
      checklistId: 'CHK-PMP-09-001',
      equipmentId: 'PMP-09',
      equipmentName: 'Weir Warman Slurry Pump',
      serviceType: 'Emergency Pump Repair',
      checklistTitle: 'MCR450 seal and liner replacement checklist',
      items: [
        { itemId: 'CHK-PMP-09-001-01', step: 1, task: 'Isolate pump, lock out motor starter, and depressurize slurry line', safetyNote: 'Verify zero energy before opening casing', estimatedTimeMinutes: 20, completed: true },
        { itemId: 'CHK-PMP-09-001-02', step: 2, task: 'Open casing and inspect impeller clearance', requiredPart: 'IMP-MCR450', estimatedTimeMinutes: 35, completed: false },
        { itemId: 'CHK-PMP-09-001-03', step: 3, task: 'Replace liner set and gland seal package', requiredPart: 'LINER-MCR450', estimatedTimeMinutes: 70, completed: false },
        { itemId: 'CHK-PMP-09-001-04', step: 4, task: 'Verify seal flush pressure and run vibration baseline', estimatedTimeMinutes: 25, completed: false },
      ],
      safetyPrecautions: ['Lockout pump motor', 'Use lifting device for casing components', 'Flush slurry residue before seal removal'],
      requiredTools: ['Dial indicator', 'Torque wrench', 'Portable vibration meter'],
      requiredParts: ['IMP-MCR450', 'LINER-MCR450', 'BRG-MCR450'],
      skillRequirement: 'Senior rotating equipment technician',
      qualityGate: 'Vibration below alarm threshold after restart',
      aiPreparationNotes: ['Liner stock is below minimum; confirm delivery before opening spare unit'],
      confidence: 88,
      status: 'Active',
      created: daysAgo(0),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      checklistId: 'CHK-DT-118-002',
      equipmentId: 'DT-118',
      equipmentName: 'Komatsu HD785 Dump Truck',
      serviceType: 'Transmission Service',
      checklistTitle: 'HD785 transmission pressure recovery checklist',
      items: [
        { itemId: 'CHK-DT-118-002-01', step: 1, task: 'Record diagnostic codes and oil temperature trend', estimatedTimeMinutes: 15, completed: true },
        { itemId: 'CHK-DT-118-002-02', step: 2, task: 'Replace transmission filter kit', requiredPart: 'TRANS-FLT-HD785', estimatedTimeMinutes: 45, completed: false },
        { itemId: 'CHK-DT-118-002-03', step: 3, task: 'Collect oil sample and inspect magnetic plug', estimatedTimeMinutes: 20, completed: false },
      ],
      safetyPrecautions: ['Chock wheels', 'Use hot oil PPE', 'Confirm truck body is lowered'],
      requiredTools: ['Pressure gauge kit', 'Oil sample bottle', 'Service laptop'],
      requiredParts: ['TRANS-FLT-HD785'],
      skillRequirement: 'Haul truck powertrain technician',
      qualityGate: 'Transmission pressure stable during loaded test cycle',
      aiPreparationNotes: ['Prioritize because truck is already unavailable'],
      confidence: 82,
      status: 'Draft',
      created: daysAgo(1),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const knowledgeDocuments = [
    {
      documentId: 'KDOC-HP500-001',
      fileName: 'hp500-lube-service-guide.pdf',
      originalName: 'Metso HP500 Lube Service Guide.pdf',
      documentType: 'OEM Schedule',
      equipmentId: 'CR-044',
      equipmentType: 'Crusher',
      uploadedAt: daysAgo(6),
      extractedTextPreview: 'HP500 lubrication circuit requires stable return flow before crusher startup. Inspect filters every 250 hours.',
      chunkCount: 2,
      status: 'Ready',
      created: daysAgo(6),
      updated: daysAgo(6),
      ...activeRecord,
    },
    {
      documentId: 'KDOC-MCR450-002',
      fileName: 'warman-mcr450-maintenance-sop.pdf',
      originalName: 'Warman MCR450 Maintenance SOP.pdf',
      documentType: 'SOP',
      equipmentId: 'PMP-09',
      equipmentType: 'Pump',
      uploadedAt: daysAgo(2),
      extractedTextPreview: 'MCR pump casing must be isolated and flushed before liner inspection. Seal flush pressure must be verified before restart.',
      chunkCount: 2,
      status: 'Ready',
      created: daysAgo(2),
      updated: daysAgo(2),
      ...activeRecord,
    },
  ];

  const knowledgeChunks = [
    ['KCH-HP500-001', 'KDOC-HP500-001', 'Metso HP500 Lube Service Guide.pdf', 'Lube startup', 0, 'Before startup, verify lube oil return flow and confirm pressure remains stable for five minutes.', ['crusher', 'lube', 'startup'], 'CR-044', 'Crusher'],
    ['KCH-HP500-002', 'KDOC-HP500-001', 'Metso HP500 Lube Service Guide.pdf', 'Service interval', 1, 'Replace HP500 lube filters every 250 operating hours or sooner if pressure differential increases.', ['filter', '250 hours', 'pressure'], 'CR-044', 'Crusher'],
    ['KCH-MCR450-001', 'KDOC-MCR450-002', 'Warman MCR450 Maintenance SOP.pdf', 'Isolation', 0, 'Lock out the pump motor, depressurize slurry line, and flush casing before opening the liner assembly.', ['pump', 'lockout', 'liner'], 'PMP-09', 'Pump'],
    ['KCH-MCR450-002', 'KDOC-MCR450-002', 'Warman MCR450 Maintenance SOP.pdf', 'Restart checks', 1, 'After replacing seal or liner, verify seal flush pressure and capture a vibration baseline before returning to service.', ['seal flush', 'vibration', 'restart'], 'PMP-09', 'Pump'],
  ].map(([chunkId, documentId, documentName, section, chunkIndex, text, keywords, equipmentId, equipmentType]) => ({
    chunkId,
    documentId,
    documentName,
    section,
    chunkIndex,
    text,
    keywords,
    equipmentId,
    equipmentType,
    created: daysAgo(2),
    updated: daysAgo(2),
    ...activeRecord,
  }));

  const vendorSlas = [
    ['SLA-CAT-001', 'Caterpillar India', 'OEM Support', ['EXC-210', 'GEN-05'], 30, 12, 9, daysFromNow(5), daysAgo(25), 0, 97, 0, 'Active'],
    ['SLA-KOM-002', 'Komatsu Mining', 'Powertrain AMC', ['DT-118'], 30, 10, 16, daysAgo(1), undefined, 1, 82, 4200, 'At Risk'],
    ['SLA-MET-003', 'Metso Outotec', 'Crusher Critical Support', ['CR-044'], 21, 8, 11, daysFromNow(3), daysAgo(19), 0, 91, 0, 'Active'],
    ['SLA-WEIR-004', 'Weir Minerals', 'Pump Rotating Equipment AMC', ['PMP-09'], 14, 6, 14, daysAgo(2), undefined, 2, 68, 9600, 'Breached'],
  ].map(([slaId, vendorName, contractType, equipmentIds, serviceFrequencyDays, committedResponseHours, actualResponseHours, plannedServiceDate, actualServiceDate, missedServiceCount, slaCompliancePercent, penaltyAmount, status]) => ({
    slaId,
    vendorName,
    contractType,
    equipmentIds,
    serviceFrequencyDays,
    committedResponseHours,
    actualResponseHours,
    plannedServiceDate,
    actualServiceDate,
    missedServiceCount,
    slaCompliancePercent,
    penaltyAmount,
    status,
    created: daysAgo(80),
    updated: daysAgo(0),
    ...activeRecord,
  }));

  const repairReplaceAnalyses = [
    {
      analysisId: 'RR-PMP-09-001',
      equipmentId: 'PMP-09',
      equipmentName: 'Weir Warman Slurry Pump',
      recommendation: 'Repair Now',
      reason: 'Replacement is not justified yet, but immediate repair avoids high production loss.',
      repairCostRatio: 0.18,
      estimatedReplacementYear: now.getFullYear() + 2,
      financialImpact: { repairOptionCost: 46000, replacementOptionCost: 185000, downtimeRisk: 78000, projectedSavings: 61000 },
      recommendedActions: ['Repair seal and liner immediately', 'Add spare liner reorder rule', 'Review pump replacement in next capital cycle'],
      decisionFactors: ['Critical current breakdown', 'Replacement lead time exceeds repair window', 'Wear trend increasing'],
      paybackEstimate: 'Immediate repair payback within 3 weeks from avoided downtime.',
      confidence: 86,
      created: daysAgo(0),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      analysisId: 'RR-CR-044-002',
      equipmentId: 'CR-044',
      equipmentName: 'Metso HP500 Cone Crusher',
      recommendation: 'Plan Replacement Study',
      reason: 'Repair cost and downtime risk are increasing as running hours exceed 31,000.',
      repairCostRatio: 0.42,
      estimatedReplacementYear: now.getFullYear() + 1,
      financialImpact: { repairOptionCost: 210000, replacementOptionCost: 940000, downtimeRisk: 165000, projectedSavings: 118000 },
      recommendedActions: ['Continue short-term repair', 'Start FY capital replacement proposal', 'Use warranty window for lube pump claim'],
      decisionFactors: ['High criticality', 'Multiple lube observations', 'Warranty expiring soon'],
      paybackEstimate: 'Replacement study needed before next budget freeze.',
      confidence: 78,
      created: daysAgo(3),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const downtimeScenarios = [
    {
      scenarioId: 'DTS-PMP-09-001',
      equipmentId: 'PMP-09',
      equipmentName: 'Weir Warman Slurry Pump',
      expectedDowntimeHours: 18,
      productionLossPerHour: 9200,
      dependentProcesses: ['Tailings transfer', 'Plant water balance', 'Concentrator throughput'],
      failureProbability: 0.72,
      repairDelayDays: 1,
      productionLoss: 165600,
      riskLevel: 'Critical',
      recommendedAction: 'Expedite liner and seal repair before next night shift.',
      recoveryPlan: ['Use standby pump for partial throughput', 'Prioritize liner delivery', 'Run vibration baseline after repair'],
      mitigationOptions: ['Emergency procurement', 'Temporary throughput reduction', 'Vendor field technician callout'],
      impactExplanation: 'Pump outage restricts tailings transfer and forces plant throughput reduction.',
      created: daysAgo(0),
      updated: daysAgo(0),
      ...activeRecord,
    },
    {
      scenarioId: 'DTS-CR-044-002',
      equipmentId: 'CR-044',
      equipmentName: 'Metso HP500 Cone Crusher',
      expectedDowntimeHours: 12,
      productionLossPerHour: 14500,
      dependentProcesses: ['Secondary crushing', 'Screening', 'Mill feed'],
      failureProbability: 0.54,
      repairDelayDays: 0,
      productionLoss: 174000,
      riskLevel: 'High',
      recommendedAction: 'Plan lube inspection during controlled shutdown.',
      recoveryPlan: ['Reduce feed rate', 'Keep bypass plan ready', 'Stage lube filter kit'],
      mitigationOptions: ['Planned shutdown window', 'OEM remote support', 'Spare lube filter staging'],
      impactExplanation: 'Crusher instability affects downstream mill feed continuity.',
      created: daysAgo(2),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const technicians = [
    ['TECH-001', 'Ravi Kumar', 'MNT-1021', ['Hydraulics', 'Excavator', 'Conveyor Alignment'], ['Excavator', 'Conveyor'], ['Hydraulic leak', 'Belt slip'], 'Available', 5.4, 94, 186, 'North Workshop'],
    ['TECH-002', 'Pooja Sharma', 'MNT-1044', ['Powertrain', 'Diagnostics', 'Drill Compressor'], ['Dump Truck', 'Drill'], ['Transmission pressure loss', 'Compressor high temperature'], 'Busy', 6.1, 91, 174, 'Mobile Service Bay'],
    ['TECH-003', 'Sanjay Rao', 'MNT-1062', ['Crusher Lubrication', 'Rotating Equipment'], ['Crusher', 'Pump'], ['Lubrication pressure dip', 'Seal failure'], 'Available', 4.8, 96, 211, 'Plant Maintenance'],
    ['TECH-004', 'Anil Reddy', 'MNT-1088', ['Hydraulic Cylinders', 'Loader Systems'], ['Excavator', 'Loader'], ['Hydraulic leak', 'Valve calibration'], 'Available', 5.9, 89, 142, 'ROM Pad'],
    ['TECH-005', 'Naveen Patil', 'MNT-1103', ['Electrical', 'Generator', 'Control Systems'], ['Generator', 'Conveyor'], ['Fuel differential pressure', 'Electrical trip'], 'On Leave', 7.2, 87, 98, 'Utilities'],
  ].map(([technicianId, technicianName, employeeId, skills, equipmentTypes, issueTypes, availabilityStatus, averageResolutionHours, successRate, completedJobs, location]) => ({
    technicianId,
    technicianName,
    employeeId,
    skills,
    equipmentTypes,
    issueTypes,
    availabilityStatus,
    averageResolutionHours,
    successRate,
    completedJobs,
    location,
    created: daysAgo(220),
    updated: daysAgo(1),
    ...activeRecord,
  }));

  const procurementOptions = [
    ['PROC-PUMP-001', 'Weir Warman MCR 450 Replacement Pump', 'Pump', 'Weir Minerals', 185000, 2, 42000, 18500, 8, 45000, 22000, 'Best fit for existing pump base and spares compatibility.'],
    ['PROC-PUMP-002', 'KSB GIW Heavy Slurry Pump', 'Pump', 'KSB Mining', 172000, 2, 47000, 19400, 7, 38000, 26000, 'Lower purchase cost but requires adapter work and new spares.'],
    ['PROC-CRUSHER-001', 'Metso HP500 Rebuild Kit', 'Crusher', 'Metso Outotec', 210000, 1, 88000, 0, 3, 25000, 165000, 'Near-term repair option for existing crusher.'],
    ['PROC-CRUSHER-002', 'Metso HP500 New Unit', 'Crusher', 'Metso Outotec', 940000, 3, 52000, 0, 10, 290000, 62000, 'Capital replacement option with lower downtime risk.'],
  ].map(([optionId, name, equipmentType, vendor, purchaseCost, warrantyYears, expectedMaintenanceCost, fuelCost, expectedLifeYears, resaleValue, downtimeRiskCost, notes]) => ({
    optionId,
    name,
    equipmentType,
    vendor,
    purchaseCost,
    warrantyYears,
    expectedMaintenanceCost,
    fuelCost,
    expectedLifeYears,
    resaleValue,
    downtimeRiskCost,
    notes,
    created: daysAgo(20),
    updated: daysAgo(1),
    ...activeRecord,
  }));

  const procurementComparisons = [
    {
      comparisonId: 'PC-PUMP-001',
      selectedOptionIds: ['PROC-PUMP-001', 'PROC-PUMP-002'],
      bestOption: 'PROC-PUMP-001',
      reason: 'Higher purchase cost is offset by lower implementation risk, shared spares, and better lifecycle confidence.',
      comparison: [
        { optionId: 'PROC-PUMP-001', name: 'Weir Warman MCR 450 Replacement Pump', fiveYearTco: 273500 },
        { optionId: 'PROC-PUMP-002', name: 'KSB GIW Heavy Slurry Pump', fiveYearTco: 291000 },
      ],
      recommendedActions: ['Negotiate warranty extension', 'Bundle liner and seal spares', 'Keep KSB as price benchmark'],
      vendorRiskSummary: 'Weir has better installed-base fit; KSB requires adapter engineering.',
      negotiationPoints: ['Warranty years', 'Critical spares kit', 'Field commissioning included'],
      decisionFactors: ['Compatibility', 'Downtime risk', 'Five-year TCO'],
      confidence: 83,
      created: daysAgo(4),
      updated: daysAgo(1),
      ...activeRecord,
    },
  ];

  const recommendations = [
    ['REC-PMP-09-001', 'PMP-09', 'Weir Warman Slurry Pump', 'Critical Breakdown', 'Restore pump before shift handover', 'Pump outage creates high production exposure and spare liner shortage.', 'Critical', 'Expedite liner delivery, complete seal replacement, and restart with vibration baseline.', 'Avoids estimated production exposure above 160,000.', 61000, 'AI', 86, 'Open'],
    ['REC-DT-118-002', 'DT-118', 'Komatsu HD785 Dump Truck', 'Service Due', 'Complete transmission service today', 'Truck is unavailable and recent observations show pressure/temperature risk.', 'High', 'Replace filter kit and run oil analysis before returning to haul cycle.', 'Reduces recurrence risk and prevents major transmission repair.', 28000, 'Service', 82, 'In Progress'],
    ['REC-CR-044-003', 'CR-044', 'Metso HP500 Cone Crusher', 'Warranty', 'Submit lube pump warranty claim', 'The lube pressure event occurred before warranty expiry.', 'High', 'Attach maintenance history and lube trend evidence to claim.', 'Recoverable cost estimated near 9,800.', 9800, 'Warranty', 79, 'Open'],
    ['REC-SPARE-004', 'PMP-09', 'Weir Warman Slurry Pump', 'Spare Part', 'Raise urgent liner PO', 'MCR450 liner stock is zero while pump repair is active.', 'Critical', 'Create emergency PO for two liner sets and adjust reorder point.', 'Avoids repeated delay on pump repairs.', 22000, 'Spare', 88, 'Open'],
  ].map(([recommendationId, equipmentId, equipmentName, recommendationType, title, reason, priority, recommendedAction, estimatedImpact, estimatedSavings, source, confidence, status]) => ({
    recommendationId,
    equipmentId,
    equipmentName,
    recommendationType,
    title,
    reason,
    priority,
    recommendedAction,
    estimatedImpact,
    estimatedSavings,
    source,
    confidence,
    status,
    created: daysAgo(0),
    updated: daysAgo(0),
    ...activeRecord,
  }));

  const reportHistory = [
    {
      period: 'weekly',
      generatedAt: now,
      report: {
        title: 'MineCare Weekly Reliability Snapshot',
        generatedAt: now.toISOString(),
        highlights: [
          'Pump PMP-09 is the highest immediate downtime risk.',
          'Crusher CR-044 has warranty opportunity and lube instability.',
          'Spares shortage exists for MCR450 liner and HP500 cone liner.',
        ],
        metrics: {
          totalEquipment: equipment.length,
          criticalAssets: 3,
          openAlerts: 3,
          potentialSavings: 120800,
          costExposure: 339600,
        },
      },
      created: now,
      updated: now,
      ...activeRecord,
    },
    {
      period: 'monthly',
      generatedAt: daysAgo(7),
      report: {
        title: 'MineCare Monthly Asset Health Report',
        generatedAt: daysAgo(7).toISOString(),
        highlights: [
          'Maintenance backlog is concentrated in processing equipment.',
          'Vendor SLA risk is highest for Weir Minerals pump support.',
          'Planned crusher replacement study should enter budget cycle.',
        ],
        metrics: {
          totalEquipment: equipment.length,
          breakdownEvents: breakdownRecords.length,
          warrantyClaims: warrantyClaims.length,
          plannedCapitalItems: 1,
        },
      },
      created: daysAgo(7),
      updated: daysAgo(7),
      ...activeRecord,
    },
  ];

  await MineCareEquipment.insertMany(equipment);
  await MineCareWarranty.insertMany(warranties);
  await MineCareServiceSchedule.insertMany(serviceSchedules);
  await MineCareMaintenanceHistory.insertMany(maintenanceHistory);
  await MineCareBreakdownRecord.insertMany(breakdownRecords);
  await MineCareOperatorObservation.insertMany(observations);
  await MineCareSparePart.insertMany(spareParts);
  await MineCareAlertStatus.insertMany(alerts);
  await MineCareActionStatus.insertMany(actions);
  await MineCareWarrantyClaimStatus.insertMany(warrantyClaims);
  await MineCareRootCauseAnalysis.insertMany(rootCauseAnalyses);
  await MineCareChecklist.insertMany(checklists);
  await MineCareKnowledgeDocument.insertMany(knowledgeDocuments);
  await MineCareKnowledgeChunk.insertMany(knowledgeChunks);
  await MineCareVendorSla.insertMany(vendorSlas);
  await MineCareRepairReplaceAnalysis.insertMany(repairReplaceAnalyses);
  await MineCareDowntimeScenario.insertMany(downtimeScenarios);
  await MineCareTechnician.insertMany(technicians);
  await MineCareProcurementOption.insertMany(procurementOptions);
  await MineCareProcurementComparison.insertMany(procurementComparisons);
  await MineCareRecommendation.insertMany(recommendations);
  await MineCareReportHistory.insertMany(reportHistory);
}

async function printCounts() {
  console.log('\nMineCare demo record counts:');
  for (const [name, model] of mineCareModels) {
    const count = await model.countDocuments({ isDeleted: false });
    console.log(`${name}: ${count}`);
  }
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB: ${mongoUri}`);
  await clearMineCareData();
  await seedMineCareData();
  await printCounts();
  await mongoose.disconnect();
  console.log('\nMineCare real-time demo data reset complete.');
}

run().catch(async (error) => {
  console.error('MineCare demo data reset failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
