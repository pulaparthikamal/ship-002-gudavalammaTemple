import { Request, Response } from 'express';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { mineCareAiService } from './mineCareAi.service';

function success(res: Response, data: unknown, message = '') {
  return res.json({
    success: true,
    statusCode: HTTP_STATUS.OK,
    respMessage: message,
    data,
    meta: null,
    errors: null,
  });
}

function created(res: Response, data: unknown, message = 'MineCare AI record created.') {
  return res.status(HTTP_STATUS.CREATED).json({
    success: true,
    statusCode: HTTP_STATUS.CREATED,
    respMessage: message,
    data,
    meta: null,
    errors: null,
  });
}

function notFound(res: Response) {
  return res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    statusCode: HTTP_STATUS.NOT_FOUND,
    respMessage: 'MineCare AI record not found.',
    data: null,
    meta: null,
    errors: null,
  });
}

export const mineCareAiController = {
  async dashboardSummary(_req: Request, res: Response) {
    return success(res, await mineCareAiService.getDashboardSummary());
  },

  async listEquipment(req: Request, res: Response) {
    const items = await mineCareAiService.listEquipment(req.query);
    return res.json({
      success: true,
      statusCode: HTTP_STATUS.OK,
      respMessage: '',
      data: items,
      meta: { page: 1, pageSize: items.length, total: items.length },
      errors: null,
    });
  },

  async getEquipment(req: Request, res: Response) {
    const details = await mineCareAiService.getEquipmentDetails(req.params.id);
    return details ? success(res, details) : notFound(res);
  },

  async createEquipment(req: Request, res: Response) {
    return created(res, await mineCareAiService.createEquipment(req.body));
  },

  async extractEquipmentDocuments(req: Request, res: Response) {
    const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files = [
      ...(filesMap?.documents ?? []),
      ...(filesMap?.['documents[]'] ?? []),
    ];
    return success(res, await mineCareAiService.extractEquipmentDocuments(files), 'MineCare AI document extraction completed.');
  },

  async updateEquipment(req: Request, res: Response) {
    const details = await mineCareAiService.updateEquipment(req.params.id, req.body);
    return details ? success(res, details, 'MineCare AI equipment updated.') : notFound(res);
  },

  async deleteEquipment(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteEquipment(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'MineCare AI equipment deleted.') : notFound(res);
  },

  async serviceCalendar(_req: Request, res: Response) {
    return success(res, await mineCareAiService.getServiceCalendar());
  },

  async completeService(req: Request, res: Response) {
    return created(res, await mineCareAiService.completeService(req.body), 'Service completed and maintenance history recorded.');
  },

  async recordBreakdownRepair(req: Request, res: Response) {
    return created(res, await mineCareAiService.recordBreakdownRepair(req.body), 'Breakdown repair recorded.');
  },

  async riskRanking(_req: Request, res: Response) {
    return success(res, await mineCareAiService.calculateRiskRanking());
  },

  async warrantyAlerts(_req: Request, res: Response) {
    return success(res, await mineCareAiService.getWarrantyAlerts());
  },

  async warrantyClaims(_req: Request, res: Response) {
    return success(res, await mineCareAiService.findWarrantyClaims());
  },

  async listObservations(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listObservations());
  },

  async createObservation(req: Request, res: Response) {
    return created(res, await mineCareAiService.createObservation(req.body), 'Operator observation recorded.');
  },

  async alerts(_req: Request, res: Response) {
    return success(res, await mineCareAiService.generateAlerts());
  },

  async spareParts(_req: Request, res: Response) {
    return success(res, await mineCareAiService.forecastSpareParts());
  },

  async budgetForecast(_req: Request, res: Response) {
    return success(res, await mineCareAiService.forecastBudget());
  },

  async actionCenter(_req: Request, res: Response) {
    return success(res, await mineCareAiService.generateActionCenter());
  },

  async recommendations(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listRecommendations());
  },

  async copilot(req: Request, res: Response) {
    return success(res, await mineCareAiService.generateCopilotResponse(req.body.question));
  },

  async executiveReport(req: Request, res: Response) {
    return success(res, await mineCareAiService.generateExecutiveReport(req.body.period ?? 'weekly'));
  },

  async executiveReportPdf(req: Request, res: Response) {
    const pdf = await mineCareAiService.generateExecutiveReportPdf(req.body.period ?? 'weekly');
    res.setHeader('Content-Type', pdf.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
    res.setHeader('Content-Length', pdf.buffer.length);
    return res.status(HTTP_STATUS.OK).send(pdf.buffer);
  },

  async updateAlertStatus(req: Request, res: Response) {
    return success(res, await mineCareAiService.updateAlertStatus(req.params.id, req.body.status), 'Alert status updated.');
  },

  async updateActionStatus(req: Request, res: Response) {
    return success(res, await mineCareAiService.updateActionStatus(req.params.id, req.body.status), 'Action status updated.');
  },

  async updateRecommendationStatus(req: Request, res: Response) {
    const item = await mineCareAiService.updateRecommendationStatus(req.params.id, req.body.status);
    return item ? success(res, item, 'Recommendation status updated.') : notFound(res);
  },

  async updateWarrantyClaimStatus(req: Request, res: Response) {
    return success(res, await mineCareAiService.updateWarrantyClaimStatus(req.params.id, req.body.status), 'Warranty claim status updated.');
  },

  async listRootCauseAnalyses(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listRootCauseAnalyses());
  },
  async analyzeRootCause(req: Request, res: Response) {
    return created(res, await mineCareAiService.analyzeRootCause(req.body), 'Root cause analysis generated.');
  },
  async getRootCauseAnalysis(req: Request, res: Response) {
    const item = await mineCareAiService.getRootCauseAnalysis(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async deleteRootCauseAnalysis(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteRootCauseAnalysis(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Root cause analysis deleted.') : notFound(res);
  },

  async listChecklists(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listChecklists());
  },
  async generateChecklist(req: Request, res: Response) {
    return created(res, await mineCareAiService.generateChecklist(req.body), 'Checklist generated.');
  },
  async getChecklist(req: Request, res: Response) {
    const item = await mineCareAiService.getChecklist(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async updateChecklist(req: Request, res: Response) {
    const item = await mineCareAiService.updateChecklist(req.params.id, req.body);
    return item ? success(res, item, 'Checklist updated.') : notFound(res);
  },
  async deleteChecklist(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteChecklist(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Checklist deleted.') : notFound(res);
  },
  async updateChecklistItem(req: Request, res: Response) {
    const item = await mineCareAiService.updateChecklistItem(req.params.id, req.params.itemId, req.body.completed);
    return item ? success(res, item, 'Checklist item updated.') : notFound(res);
  },

  async uploadKnowledgeDocument(req: Request, res: Response) {
    const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files = [...(filesMap?.documents ?? []), ...(filesMap?.['documents[]'] ?? [])];
    return created(res, await mineCareAiService.uploadKnowledgeDocument(files, req.body), 'Knowledge document uploaded.');
  },
  async listKnowledgeDocuments(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listKnowledgeDocuments());
  },
  async deleteKnowledgeDocument(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteKnowledgeDocument(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Knowledge document deleted.') : notFound(res);
  },
  async askKnowledgeAssistant(req: Request, res: Response) {
    return success(res, await mineCareAiService.askKnowledgeAssistant(req.body));
  },

  async listVendorSlas(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listVendorSlas());
  },
  async createVendorSla(req: Request, res: Response) {
    return created(res, await mineCareAiService.createVendorSla(req.body), 'Vendor SLA created.');
  },
  async getVendorSla(req: Request, res: Response) {
    const item = await mineCareAiService.getVendorSla(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async updateVendorSla(req: Request, res: Response) {
    const item = await mineCareAiService.updateVendorSla(req.params.id, req.body);
    return item ? success(res, item, 'Vendor SLA updated.') : notFound(res);
  },
  async deleteVendorSla(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteVendorSla(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Vendor SLA deleted.') : notFound(res);
  },
  async vendorSlaScorecard(_req: Request, res: Response) {
    return success(res, await mineCareAiService.getVendorSlaScorecard());
  },

  async listRepairReplaceAnalyses(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listRepairReplaceAnalyses());
  },
  async analyzeRepairReplace(req: Request, res: Response) {
    return created(res, await mineCareAiService.analyzeRepairReplace(req.body), 'Repair/replace analysis generated.');
  },
  async getRepairReplaceAnalysis(req: Request, res: Response) {
    const item = await mineCareAiService.getRepairReplaceAnalysis(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async deleteRepairReplaceAnalysis(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteRepairReplaceAnalysis(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Repair/replace analysis deleted.') : notFound(res);
  },

  async listDowntimeScenarios(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listDowntimeScenarios());
  },
  async simulateDowntime(req: Request, res: Response) {
    return created(res, await mineCareAiService.simulateDowntime(req.body), 'Downtime scenario simulated.');
  },
  async getDowntimeScenario(req: Request, res: Response) {
    const item = await mineCareAiService.getDowntimeScenario(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async deleteDowntimeScenario(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteDowntimeScenario(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Downtime scenario deleted.') : notFound(res);
  },

  async listTechnicians(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listTechnicians());
  },
  async createTechnician(req: Request, res: Response) {
    return created(res, await mineCareAiService.createTechnician(req.body), 'Technician created.');
  },
  async getTechnician(req: Request, res: Response) {
    const item = await mineCareAiService.getTechnician(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async updateTechnician(req: Request, res: Response) {
    const item = await mineCareAiService.updateTechnician(req.params.id, req.body);
    return item ? success(res, item, 'Technician updated.') : notFound(res);
  },
  async deleteTechnician(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteTechnician(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Technician deleted.') : notFound(res);
  },
  async recommendTechnician(req: Request, res: Response) {
    return success(res, await mineCareAiService.recommendTechnician(req.body));
  },

  async listProcurementOptions(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listProcurementOptions());
  },
  async listProcurementComparisons(_req: Request, res: Response) {
    return success(res, await mineCareAiService.listProcurementComparisons());
  },
  async createProcurementOption(req: Request, res: Response) {
    return created(res, await mineCareAiService.createProcurementOption(req.body), 'Procurement option created.');
  },
  async getProcurementOption(req: Request, res: Response) {
    const item = await mineCareAiService.getProcurementOption(req.params.id);
    return item ? success(res, item) : notFound(res);
  },
  async updateProcurementOption(req: Request, res: Response) {
    const item = await mineCareAiService.updateProcurementOption(req.params.id, req.body);
    return item ? success(res, item, 'Procurement option updated.') : notFound(res);
  },
  async deleteProcurementOption(req: Request, res: Response) {
    const deleted = await mineCareAiService.deleteProcurementOption(req.params.id);
    return deleted ? success(res, { id: req.params.id }, 'Procurement option deleted.') : notFound(res);
  },
  async compareProcurementOptions(req: Request, res: Response) {
    return created(res, await mineCareAiService.compareProcurementOptions(req.body), 'Procurement options compared.');
  },
};
