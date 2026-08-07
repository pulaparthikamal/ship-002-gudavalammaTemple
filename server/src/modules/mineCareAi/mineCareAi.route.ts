import { Router } from 'express';
import multer from 'multer';
import { envConfig } from '../../config/env.config';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { mineCareAiController } from './mineCareAi.controller';
import {
  copilotSchema,
  checklistGenerateSchema,
  checklistItemSchema,
  checklistUpdateSchema,
  completeServiceSchema,
  createEquipmentSchema,
  createObservationSchema,
  downtimeSimulateSchema,
  executiveReportSchema,
  actionStatusSchema,
  alertStatusSchema,
  idParamSchema,
  knowledgeAskSchema,
  procurementCompareSchema,
  procurementOptionSchema,
  repairReplaceAnalyzeSchema,
  recordBreakdownRepairSchema,
  recommendationStatusSchema,
  rootCauseAnalyzeSchema,
  technicianRecommendSchema,
  technicianSchema,
  updateEquipmentSchema,
  updateProcurementOptionSchema,
  updateTechnicianSchema,
  updateVendorSlaSchema,
  vendorSlaSchema,
  warrantyClaimStatusSchema,
} from './mineCareAi.schema';

const router = Router();
const documentUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: envConfig.uploadMaxFileSizeMb * 1024 * 1024 },
});

router.use(authMiddleware);

router.get('/dashboard/summary', asyncHandler(mineCareAiController.dashboardSummary));

router.get('/equipment', asyncHandler(mineCareAiController.listEquipment));
router.post(
  '/equipment/extract-documents',
  (documentUploadMiddleware as any).fields([
    { name: 'documents[]', maxCount: 10 },
    { name: 'documents', maxCount: 10 },
  ]),
  asyncHandler(mineCareAiController.extractEquipmentDocuments)
);
router.get('/equipment/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getEquipment));
router.post('/equipment', validate(createEquipmentSchema), asyncHandler(mineCareAiController.createEquipment));
router.put('/equipment/:id', validate(updateEquipmentSchema), asyncHandler(mineCareAiController.updateEquipment));
router.delete('/equipment/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteEquipment));

router.get('/service-calendar', asyncHandler(mineCareAiController.serviceCalendar));
router.post('/service-calendar/complete', validate(completeServiceSchema), asyncHandler(mineCareAiController.completeService));
router.post('/breakdowns/record-repair', validate(recordBreakdownRepairSchema), asyncHandler(mineCareAiController.recordBreakdownRepair));
router.get('/risk-ranking', asyncHandler(mineCareAiController.riskRanking));
router.get('/warranty-alerts', asyncHandler(mineCareAiController.warrantyAlerts));
router.get('/warranty-claims', asyncHandler(mineCareAiController.warrantyClaims));

router.get('/operator-observations', asyncHandler(mineCareAiController.listObservations));
router.post('/operator-observations', validate(createObservationSchema), asyncHandler(mineCareAiController.createObservation));

router.get('/alerts', asyncHandler(mineCareAiController.alerts));
router.patch('/alerts/:id/status', validate(alertStatusSchema), asyncHandler(mineCareAiController.updateAlertStatus));
router.get('/spare-parts', asyncHandler(mineCareAiController.spareParts));
router.get('/budget-forecast', asyncHandler(mineCareAiController.budgetForecast));
router.get('/action-center', asyncHandler(mineCareAiController.actionCenter));
router.patch('/action-center/:id/status', validate(actionStatusSchema), asyncHandler(mineCareAiController.updateActionStatus));
router.get('/recommendations', asyncHandler(mineCareAiController.recommendations));
router.patch('/recommendations/:id/status', validate(recommendationStatusSchema), asyncHandler(mineCareAiController.updateRecommendationStatus));

router.post('/copilot', validate(copilotSchema), asyncHandler(mineCareAiController.copilot));
router.post('/reports/executive', validate(executiveReportSchema), asyncHandler(mineCareAiController.executiveReport));
router.post('/reports/executive/pdf', validate(executiveReportSchema), asyncHandler(mineCareAiController.executiveReportPdf));
router.patch('/warranty-claims/:id/status', validate(warrantyClaimStatusSchema), asyncHandler(mineCareAiController.updateWarrantyClaimStatus));

router.get('/root-cause', asyncHandler(mineCareAiController.listRootCauseAnalyses));
router.post('/root-cause/analyze', validate(rootCauseAnalyzeSchema), asyncHandler(mineCareAiController.analyzeRootCause));
router.get('/root-cause/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getRootCauseAnalysis));
router.delete('/root-cause/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteRootCauseAnalysis));

router.get('/checklists', asyncHandler(mineCareAiController.listChecklists));
router.post('/checklists/generate', validate(checklistGenerateSchema), asyncHandler(mineCareAiController.generateChecklist));
router.patch('/checklists/:id/items/:itemId', validate(checklistItemSchema), asyncHandler(mineCareAiController.updateChecklistItem));
router.get('/checklists/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getChecklist));
router.put('/checklists/:id', validate(checklistUpdateSchema), asyncHandler(mineCareAiController.updateChecklist));
router.delete('/checklists/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteChecklist));

router.post(
  '/knowledge/upload',
  (documentUploadMiddleware as any).fields([
    { name: 'documents[]', maxCount: 10 },
    { name: 'documents', maxCount: 10 },
  ]),
  asyncHandler(mineCareAiController.uploadKnowledgeDocument)
);
router.get('/knowledge/documents', asyncHandler(mineCareAiController.listKnowledgeDocuments));
router.delete('/knowledge/documents/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteKnowledgeDocument));
router.post('/knowledge/ask', validate(knowledgeAskSchema), asyncHandler(mineCareAiController.askKnowledgeAssistant));

router.get('/vendor-sla', asyncHandler(mineCareAiController.listVendorSlas));
router.get('/vendor-sla/scorecard', asyncHandler(mineCareAiController.vendorSlaScorecard));
router.post('/vendor-sla', validate(vendorSlaSchema), asyncHandler(mineCareAiController.createVendorSla));
router.get('/vendor-sla/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getVendorSla));
router.put('/vendor-sla/:id', validate(updateVendorSlaSchema), asyncHandler(mineCareAiController.updateVendorSla));
router.delete('/vendor-sla/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteVendorSla));

router.get('/repair-replace', asyncHandler(mineCareAiController.listRepairReplaceAnalyses));
router.post('/repair-replace/analyze', validate(repairReplaceAnalyzeSchema), asyncHandler(mineCareAiController.analyzeRepairReplace));
router.get('/repair-replace/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getRepairReplaceAnalysis));
router.delete('/repair-replace/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteRepairReplaceAnalysis));

router.get('/downtime/scenarios', asyncHandler(mineCareAiController.listDowntimeScenarios));
router.post('/downtime/simulate', validate(downtimeSimulateSchema), asyncHandler(mineCareAiController.simulateDowntime));
router.get('/downtime/scenarios/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getDowntimeScenario));
router.delete('/downtime/scenarios/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteDowntimeScenario));

router.get('/workforce', asyncHandler(mineCareAiController.listTechnicians));
router.post('/workforce/recommend', validate(technicianRecommendSchema), asyncHandler(mineCareAiController.recommendTechnician));
router.post('/workforce', validate(technicianSchema), asyncHandler(mineCareAiController.createTechnician));
router.get('/workforce/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getTechnician));
router.put('/workforce/:id', validate(updateTechnicianSchema), asyncHandler(mineCareAiController.updateTechnician));
router.delete('/workforce/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteTechnician));

router.get('/procurement-options', asyncHandler(mineCareAiController.listProcurementOptions));
router.post('/procurement-options/compare', validate(procurementCompareSchema), asyncHandler(mineCareAiController.compareProcurementOptions));
router.get('/procurement-options/comparisons', asyncHandler(mineCareAiController.listProcurementComparisons));
router.post('/procurement-options', validate(procurementOptionSchema), asyncHandler(mineCareAiController.createProcurementOption));
router.get('/procurement-options/:id', validate(idParamSchema), asyncHandler(mineCareAiController.getProcurementOption));
router.put('/procurement-options/:id', validate(updateProcurementOptionSchema), asyncHandler(mineCareAiController.updateProcurementOption));
router.delete('/procurement-options/:id', validate(idParamSchema), asyncHandler(mineCareAiController.deleteProcurementOption));

export default router;
