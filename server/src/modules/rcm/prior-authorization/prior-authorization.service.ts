import { PriorAuthorization } from './prior-authorization.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Patient } from '../patient/patient.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Provider } from '../provider/provider.model';
import { Facility } from '../facility/facility.model';
import { Encounter } from '../encounter/encounter.model';
import { rcmAiService } from '../workflow/rcm-ai.service';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function buildAuthChecklist(item: any, context: Record<string, any>, authPredictions: any[]) {
  const checklist = [
    {
      key: 'patient-demographics',
      label: 'Patient demographics',
      complete: Boolean(context.patient?.firstName && context.patient?.lastName && context.patient?.dateOfBirth),
      blocker: 'Patient name and DOB are required for payer authorization.',
    },
    {
      key: 'insurance',
      label: 'Insurance and member ID',
      complete: Boolean(context.insurance?.memberId && context.payer?.payerId),
      blocker: 'Insurance member ID and payer routing are required.',
    },
    {
      key: 'ordering-provider',
      label: 'Ordering/rendering provider NPI',
      complete: Boolean(context.provider?.npi),
      blocker: 'Provider NPI is required.',
    },
    {
      key: 'facility',
      label: 'Facility NPI and place of service',
      complete: Boolean(context.facility?.npi && (item.placeOfService || context.facility?.placeOfServiceCode)),
      blocker: 'Facility NPI and place of service are required.',
    },
    {
      key: 'procedure-diagnosis',
      label: 'Procedure and diagnosis support',
      complete: Boolean(item.procedureCodes?.length && item.diagnosisCodes?.length),
      blocker: 'CPT and ICD codes are required for authorization packet.',
    },
    {
      key: 'medical-necessity',
      label: 'AI medical necessity/auth rule review',
      complete: authPredictions.every((prediction) => prediction.requiresAuth !== false || prediction.confidence >= 0.7),
      blocker: 'Review AI auth prediction and payer-specific medical necessity notes.',
    },
  ];

  return checklist.map((entry) => ({
    ...entry,
    status: entry.complete ? 'Complete' : 'Missing',
    nextAction: entry.complete ? 'Ready' : entry.blocker,
  }));
}

async function resolveAuthContext(item: any) {
  const [patient, insurance, provider, facility] = await Promise.all([
    item.patientId ? Patient.findOne({ _id: item.patientId, isDeleted: false }) : null,
    item.insuranceId ? InsurancePolicy.findOne({ _id: item.insuranceId, isDeleted: false }) : null,
    item.providerId ? Provider.findOne({ _id: item.providerId, isDeleted: false }) : null,
    item.facilityId ? Facility.findOne({ _id: item.facilityId, isDeleted: false }) : null,
  ]);
  const payerReference = normalizeText(item.payerId) ?? normalizeText(insurance?.payerId);
  const payer = payerReference
    ? await Payer.findOne({
        isDeleted: false,
        $or: [{ payerId: payerReference }, { _id: payerReference }],
      })
    : null;
  const encounter = item.patientId
    ? await Encounter.findOne({ patientId: item.patientId, isDeleted: false }).sort({ encounterDate: -1, updated: -1 })
    : null;

  return { patient, insurance, payer, provider, facility, encounter };
}

export const priorAuthorizationService = {
  async create(data: any, locale: string, createdBy: string) {
    const item = await PriorAuthorization.create({
      ...data,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await PriorAuthorization.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('priorAuthorization.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await PriorAuthorization.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('priorAuthorization.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async generateAuthPacket(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const context = await resolveAuthContext(item);
    const payerId = normalizeText(item.payerId) ?? normalizeText(context.insurance?.payerId) ?? '';
    const diagnosisCodes = item.diagnosisCodes ?? context.encounter?.diagnosisCodes ?? [];
    const authPredictions = await Promise.all(
      (item.procedureCodes ?? []).map(async (cptCode: string) => ({
        cptCode,
        ...(await rcmAiService.predictAuth(cptCode, payerId, diagnosisCodes)),
      }))
    );
    const documentChecklist = buildAuthChecklist(item, context, authPredictions);
    const missingItems = documentChecklist.filter((entry) => !entry.complete);

    item.authPacket = {
      generatedAt: new Date(),
      payer: {
        payerId: context.payer?.payerId ?? payerId,
        payerName: context.payer?.payerName,
        portalUrl: (context.payer as any)?.portalUrl,
      },
      patient: {
        patientId: item.patientId,
        firstName: context.patient?.firstName,
        lastName: context.patient?.lastName,
        dateOfBirth: context.patient?.dateOfBirth,
      },
      insurance: {
        insuranceId: item.insuranceId,
        memberId: context.insurance?.memberId,
        groupNumber: context.insurance?.groupNumber,
        relationshipToSubscriber: context.insurance?.relationshipToSubscriber,
      },
      provider: {
        providerId: item.providerId,
        npi: context.provider?.npi,
        name: [context.provider?.firstName, context.provider?.lastName].filter(Boolean).join(' '),
      },
      facility: {
        facilityId: item.facilityId,
        facilityName: context.facility?.facilityName,
        npi: context.facility?.npi,
        placeOfService: item.placeOfService ?? context.facility?.placeOfServiceCode,
      },
      service: {
        serviceDate: item.serviceDate,
        procedureCodes: item.procedureCodes ?? [],
        diagnosisCodes,
        requestedUnits: item.requestedUnits,
      },
      ai: {
        authPredictions,
        recommendedSummary:
          missingItems.length
            ? 'Authorization packet has missing required data before payer submission.'
            : 'Authorization packet is ready for payer portal or clearinghouse submission.',
      },
    };
    item.documentChecklist = documentChecklist;
    item.automationStatus = missingItems.length ? 'Packet Needs Documents' : 'Packet Ready';
    item.statusHistory = [
      ...(item.statusHistory ?? []),
      `${new Date().toISOString()} - Authorization packet generated`,
    ];
    item.updatedBy = updatedBy;
    item.updated = new Date();
    await item.save();

    return item;
  },

  async submitPacket(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);

    if (!item.authPacket || !Object.keys(item.authPacket).length) {
      throw buildValidationError('Generate the authorization packet before payer submission.');
    }

    const missingItems = (item.documentChecklist ?? []).filter((entry: any) => !entry.complete);
    if (missingItems.length) {
      throw buildValidationError('Authorization packet cannot be submitted while required checklist items are missing.');
    }

    item.authorizationStatus = 'Submitted';
    item.automationStatus = 'Submitted to Payer';
    item.payerPortalReference = item.payerPortalReference ?? `AUTH-${String(item._id).slice(-6).toUpperCase()}-${Date.now()}`;
    item.requestDate = item.requestDate ?? new Date();
    item.statusHistory = [
      ...(item.statusHistory ?? []),
      `${new Date().toISOString()} - Packet submitted to payer (${item.payerPortalReference})`,
    ];
    item.updatedBy = updatedBy;
    item.updated = new Date();
    await item.save();

    return item;
  },

  async checkPayerStatus(id: string, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const currentStatus = normalizeText(item.authorizationStatus)?.toLowerCase();
    const nextStatus =
      currentStatus === 'submitted' || currentStatus === 'in review'
        ? 'In Review'
        : currentStatus === 'approved' || currentStatus === 'authorized'
          ? item.authorizationStatus
          : item.authorizationStatus ?? 'Pending';

    item.authorizationStatus = nextStatus;
    item.automationStatus = nextStatus === 'In Review' ? 'Payer Review In Progress' : item.automationStatus ?? 'Pending Payer Action';
    item.statusCheckHistory = [
      ...(item.statusCheckHistory ?? []),
      {
        checkedAt: new Date(),
        source: 'payer-status-automation-demo',
        status: item.authorizationStatus,
        payerPortalReference: item.payerPortalReference,
        nextAction:
          nextStatus === 'In Review'
            ? 'Monitor payer response and upload approval letter when received.'
            : 'Submit packet or update payer response manually.',
      },
    ];
    item.updatedBy = updatedBy;
    item.updated = new Date();
    await item.save();

    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await PriorAuthorization.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('priorAuthorization.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
