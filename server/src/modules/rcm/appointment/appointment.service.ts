import { Appointment } from './appointment.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { APPOINTMENT_STATUS_OPTIONS, CHECK_IN_STATUS_OPTIONS } from './appointment.constants';
import { appendStatusHistory } from '../workflow/workflow-history';
import { encounterService } from '../encounter/encounter.service';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Patient } from '../patient/patient.model';
import { Provider } from '../provider/provider.model';
import { Facility } from '../facility/facility.model';
import { eligibilityVerificationService } from '../eligibility-verification/eligibility-verification.service';
import { EligibilityVerification } from '../eligibility-verification/eligibility-verification.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { Referral } from '../referral/referral.model';
import { Encounter } from '../encounter/encounter.model';
import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

const COMPLETED_STATUSES = new Set(['Completed']);
const CHECKED_IN_STATUSES = new Set(['Checked In', 'In Progress']);
const CHECKED_OUT_STATUSES = new Set(['Checked Out']);
const NO_SHOW_STATUS = 'No Show';
const CANCELLED_STATUS = 'Cancelled';
const APPOINTMENT_CHECKED_IN_STATUS = 'Checked In';
const APPOINTMENT_IN_PROGRESS_STATUS = 'In Progress';
const SYSTEM_MANAGED_APPOINTMENT_STATUSES = new Set([
  APPOINTMENT_CHECKED_IN_STATUS,
  APPOINTMENT_IN_PROGRESS_STATUS,
  'Completed',
]);
const SYSTEM_MANAGED_CHECK_IN_STATUSES = new Set([
  APPOINTMENT_CHECKED_IN_STATUS,
  'Checked Out',
]);
const APPROVED_AUTHORIZATION_STATUSES = new Set(['approved', 'authorized', 'certified']);
const INVALID_REFERRAL_STATUSES = new Set(['denied', 'cancelled', 'canceled', 'expired', 'closed']);

type AppointmentSummary = {
  awaitingArrival: number;
  inClinic: number;
  completed: number;
  exceptions: number;
  financialHold: number;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function normalizeBusinessDate(value: unknown) {
  const dateValue = normalizeDate(value);

  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return undefined;
  }

  return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
}

function parseAppointmentTime(value: unknown) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return undefined;
  }

  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);

  if (!match) {
    throw new AppError('Appointment time must use HH:mm or h:mm AM/PM format.', HTTP_STATUS.BAD_REQUEST);
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new AppError('Appointment time must use a valid hour and minute value.', HTTP_STATUS.BAD_REQUEST);
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      throw new AppError('Appointment time must use a valid 12-hour clock value.', HTTP_STATUS.BAD_REQUEST);
    }

    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours < 0 || hours > 23) {
    throw new AppError('Appointment time must use a valid 24-hour clock value.', HTTP_STATUS.BAD_REQUEST);
  }

  return {
    canonical: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

function buildAppointmentStart(appointmentDate?: Date, appointmentTime?: string) {
  if (!(appointmentDate instanceof Date) || Number.isNaN(appointmentDate.getTime()) || !appointmentTime) {
    return undefined;
  }

  const [hours, minutes] = appointmentTime.split(':').map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return undefined;
  }

  const appointmentStart = new Date(appointmentDate);
  appointmentStart.setHours(hours, minutes, 0, 0);
  return appointmentStart;
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function normalizeTextLower(value: unknown) {
  return normalizeText(value)?.toLowerCase();
}

function isActiveEligibilityStatus(value: unknown) {
  const normalizedValue = normalizeTextLower(value);

  if (!normalizedValue) {
    return false;
  }

  return normalizedValue === 'active'
    || normalizedValue === 'eligible'
    || normalizedValue === 'covered'
    || normalizedValue === 'completed'
    || normalizedValue.includes('active')
    || normalizedValue.includes('eligible')
    || normalizedValue.includes('covered');
}

function isDateOnOrAfter(left?: Date, right?: Date) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime()) || !(right instanceof Date) || Number.isNaN(right.getTime())) {
    return true;
  }

  return left.getTime() >= right.getTime();
}

function isDateOnOrBefore(left?: Date, right?: Date) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime()) || !(right instanceof Date) || Number.isNaN(right.getTime())) {
    return true;
  }

  return left.getTime() <= right.getTime();
}

function isDateWithinRange(target?: Date, start?: Date, end?: Date) {
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) {
    return false;
  }

  return isDateOnOrAfter(target, start) && isDateOnOrBefore(target, end);
}

function getAppointmentServiceDate(appointment: any) {
  return (
    normalizeBusinessDate(appointment?.appointmentStart)
    ?? normalizeBusinessDate(appointment?.appointmentDate)
    ?? normalizeBusinessDate(new Date())
    ?? new Date()
  );
}

function isAppointmentCheckInStatusEligible(appointment: any) {
  return ![CANCELLED_STATUS, NO_SHOW_STATUS, APPOINTMENT_CHECKED_IN_STATUS, APPOINTMENT_IN_PROGRESS_STATUS, 'Completed'].includes(
    appointment?.appointmentStatus ?? ''
  );
}

async function resolvePrimaryInsurancePolicy(patientId: unknown) {
  return InsurancePolicy.findOne({
    patientId,
    active: true,
    isDeleted: false,
  }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 });
}

async function resolvePayerByReference(payerReference: unknown) {
  const normalizedReference = normalizeText(payerReference);

  if (!normalizedReference) {
    return null;
  }

  const payerConditions: Array<Record<string, unknown>> = [{ payerId: normalizedReference }];

  if (mongoose.Types.ObjectId.isValid(normalizedReference)) {
    payerConditions.push({ _id: normalizedReference });
  }

  return Payer.findOne({
    isDeleted: false,
    active: true,
    $or: payerConditions,
  });
}

async function resolveCheckInInsurancePolicy(patientId: unknown, serviceDate: Date) {
  const policies = await InsurancePolicy.find({
    patientId,
    active: true,
    isDeleted: false,
  }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 });

  return policies.find((policy) => {
    const coverageType = normalizeTextLower(policy.coverageType);
    const policyStatus = normalizeTextLower(policy.policyStatus);

    if (coverageType === 'self pay') {
      return false;
    }

    if (policyStatus && ['inactive', 'terminated', 'cancelled', 'canceled'].includes(policyStatus)) {
      return false;
    }

    return (
      isDateOnOrAfter(serviceDate, normalizeBusinessDate(policy.effectiveDate))
      && isDateOnOrAfter(normalizeBusinessDate(policy.terminationDate), serviceDate)
    );
  }) ?? null;
}

async function resolveSelfPayPolicy(patientId: unknown, serviceDate: Date) {
  const policies = await InsurancePolicy.find({
    patientId,
    active: true,
    isDeleted: false,
    coverageType: /^self pay$/i,
  }).sort({ updated: -1 });

  return policies.find((policy) => {
    const policyStatus = normalizeTextLower(policy.policyStatus);

    if (policyStatus && ['inactive', 'terminated', 'cancelled', 'canceled'].includes(policyStatus)) {
      return false;
    }

    return (
      isDateOnOrAfter(serviceDate, normalizeBusinessDate(policy.effectiveDate))
      && isDateOnOrAfter(normalizeBusinessDate(policy.terminationDate), serviceDate)
    );
  }) ?? null;
}

async function resolveLatestEligibilityVerification(patientId: unknown, insuranceId?: unknown) {
  if (!patientId) {
    return null;
  }

  const filter: Record<string, unknown> = {
    patientId,
    active: true,
    isDeleted: false,
  };

  if (insuranceId) {
    filter.insuranceId = insuranceId;
  }

  return EligibilityVerification.findOne(filter).sort({ checkedAt: -1, updated: -1 });
}

async function ensureAppointmentAuthorizationReady(appointment: any, insurancePolicy: any, serviceDate: Date) {
  const priorAuthorizations = await PriorAuthorization.find({
    patientId: appointment.patientId,
    insuranceId: insurancePolicy?._id,
    active: true,
    isDeleted: false,
  }).sort({ updated: -1, requestDate: -1 });

  const matchingAuthorization = priorAuthorizations.find((authorization) => {
    const status = normalizeTextLower(authorization.authorizationStatus);
    return (
      Boolean(status && APPROVED_AUTHORIZATION_STATUSES.has(status))
      && Boolean(normalizeText(authorization.authNumber))
      && isDateOnOrAfter(normalizeBusinessDate(authorization.expirationDate), serviceDate)
    );
  });

  if (!matchingAuthorization) {
    throw buildValidationError('An approved prior authorization is required before check-in.');
  }
}

async function ensureAppointmentReferralReady(appointment: any, insurancePolicy: any, serviceDate: Date) {
  const appointmentReferralNumber = normalizeText(appointment?.referral?.referralNumber);

  if (
    appointment?.referral?.required
    && appointmentReferralNumber
    && isDateWithinRange(
      serviceDate,
      normalizeBusinessDate(appointment?.referral?.validFrom),
      normalizeBusinessDate(appointment?.referral?.validTo)
    )
  ) {
    return;
  }

  const referrals = await Referral.find({
    patientId: appointment.patientId,
    active: true,
    isDeleted: false,
    ...(insurancePolicy?.payerId ? { payerId: insurancePolicy.payerId } : {}),
  }).sort({ updated: -1, startDate: -1 });

  const matchingReferral = referrals.find((referral) => {
    const status = normalizeTextLower(referral.referralStatus);

    return (
      Boolean(normalizeText(referral.referralNumber))
      && (!referral.appointmentId || String(referral.appointmentId) === String(appointment._id))
      && (typeof referral.remainingVisits !== 'number' || referral.remainingVisits > 0)
      && (!status || !INVALID_REFERRAL_STATUSES.has(status))
      && isDateWithinRange(
        serviceDate,
        normalizeBusinessDate(referral.startDate),
        normalizeBusinessDate(referral.endDate)
      )
    );
  });

  if (!matchingReferral) {
    throw buildValidationError('A valid referral is required before check-in.');
  }
}

async function ensureCheckInFinancialClearance(appointment: any) {
  if (!appointment.patientId || !appointment.providerId || !appointment.facilityId) {
    throw buildValidationError('Patient, provider, and facility must be assigned before check-in.');
  }

  const serviceDate = getAppointmentServiceDate(appointment);
  const insurancePolicy = await resolveCheckInInsurancePolicy(appointment.patientId, serviceDate);

  if (!insurancePolicy) {
    const selfPayPolicy = await resolveSelfPayPolicy(appointment.patientId, serviceDate);

    if (selfPayPolicy) {
      return;
    }

    throw buildValidationError(
      'No active insured coverage is on file. Correct insurance or route the visit to self-pay before check-in.'
    );
  }

  const latestEligibility = await resolveLatestEligibilityVerification(appointment.patientId, insurancePolicy._id);

  if (!latestEligibility) {
    throw buildValidationError('Eligibility must be verified before check-in.');
  }

  if (
    latestEligibility.planActive === false
    || !isActiveEligibilityStatus(latestEligibility.coverageStatus ?? latestEligibility.eligibilityStatus)
  ) {
    throw buildValidationError('Latest eligibility verification shows inactive coverage.');
  }

  const lastVerifiedAt =
    normalizeDate(insurancePolicy?.verification?.lastVerifiedDateTime)
    ?? normalizeDate(latestEligibility.checkedAt);

  if (!lastVerifiedAt) {
    throw buildValidationError('Eligibility must be verified before check-in.');
  }

  const nextVerificationDueDate = normalizeBusinessDate(insurancePolicy?.verification?.nextVerificationDueDate);

  if (nextVerificationDueDate && nextVerificationDueDate.getTime() < serviceDate.getTime()) {
    throw buildValidationError('Eligibility must be reverified for the date of service.');
  }

  if (latestEligibility.authorizationRequired) {
    await ensureAppointmentAuthorizationReady(appointment, insurancePolicy, serviceDate);
  }

  if (latestEligibility.referralRequired) {
    await ensureAppointmentReferralReady(appointment, insurancePolicy, serviceDate);
  }
}

function validateAppointmentWorkflow(candidate: any) {
  if (!candidate.patientId || !candidate.providerId || !candidate.facilityId) {
    throw buildValidationError('Patient, provider, and facility are required for an appointment.');
  }

  if (!(candidate.appointmentDate instanceof Date) || Number.isNaN(candidate.appointmentDate.getTime())) {
    throw buildValidationError('Appointment date is required.');
  }

  if (!candidate.appointmentTime) {
    throw buildValidationError('Appointment time is required.');
  }

  if (!candidate.appointmentType || !candidate.visitType || !candidate.reason) {
    throw buildValidationError('Appointment type, visit type, and reason are required.');
  }

  if (candidate.appointmentStatus === CANCELLED_STATUS && !candidate.cancellationReason) {
    throw buildValidationError('Cancellation reason is required when the appointment is cancelled.');
  }

  if (candidate.appointmentStatus && !APPOINTMENT_STATUS_OPTIONS.includes(candidate.appointmentStatus)) {
    throw buildValidationError('Appointment status is invalid.');
  }

  if (candidate.checkInStatus && !CHECK_IN_STATUS_OPTIONS.includes(candidate.checkInStatus)) {
    throw buildValidationError('Check-in status is invalid.');
  }

  if (candidate.appointmentStatus === NO_SHOW_STATUS && !candidate.noShowFlag) {
    throw buildValidationError('No Show appointments must set the no-show flag.');
  }

  if (candidate.noShowFlag && candidate.appointmentStatus !== NO_SHOW_STATUS) {
    throw buildValidationError('No-show flag can only be set when the appointment status is No Show.');
  }

  if ((CHECKED_IN_STATUSES.has(candidate.checkInStatus) || candidate.checkInTime) && !candidate.checkInTime) {
    throw buildValidationError('Check-in time is required when the patient has been checked in.');
  }

  if ((CHECKED_OUT_STATUSES.has(candidate.checkInStatus) || candidate.checkOutTime) && !candidate.checkOutTime) {
    throw buildValidationError('Check-out time is required when the patient has been checked out.');
  }

  if (candidate.checkOutTime && !candidate.checkInTime) {
    throw buildValidationError('Check-in time must be recorded before check-out time.');
  }

  if (COMPLETED_STATUSES.has(candidate.appointmentStatus) && !candidate.checkOutTime) {
    throw buildValidationError('Completed appointments must include a check-out time.');
  }

  if (candidate.estimate?.depositCollected && !candidate.estimate?.depositAmount) {
    throw buildValidationError('Deposit amount is required when a deposit has been collected.');
  }
}

async function validateAppointmentReferences(candidate: any) {
  const [patient, provider, facility] = await Promise.all([
    Patient.findOne({ _id: candidate.patientId, isDeleted: false, active: true }),
    Provider.findOne({ _id: candidate.providerId, isDeleted: false, active: true }),
    Facility.findOne({ _id: candidate.facilityId, isDeleted: false, active: true }),
  ]);

  if (!patient) {
    throw buildValidationError('Appointment patient must reference an active patient.');
  }

  if (!provider) {
    throw buildValidationError('Appointment provider must reference an active provider.');
  }

  if (!facility) {
    throw buildValidationError('Appointment facility must reference an active facility.');
  }

  if (patient.deceased) {
    throw buildValidationError('Cannot schedule an appointment for a deceased patient.');
  }
}

function normalizeAppointmentData(data: any) {
  const normalizedData = { ...data };
  const parsedAppointmentTime = parseAppointmentTime(data.appointmentTime);

  if (data.appointmentDate !== undefined) {
    normalizedData.appointmentDate = normalizeDate(data.appointmentDate);
  }

  if (data.checkInTime !== undefined) {
    normalizedData.checkInTime = normalizeDate(data.checkInTime);
  }

  if (data.checkOutTime !== undefined) {
    normalizedData.checkOutTime = normalizeDate(data.checkOutTime);
  }

  if (parsedAppointmentTime) {
    normalizedData.appointmentTime = parsedAppointmentTime.canonical;
  }

  if (data.reason !== undefined) {
    normalizedData.reason = normalizeText(data.reason);
  }

  if (data.cancellationReason !== undefined) {
    normalizedData.cancellationReason = normalizeText(data.cancellationReason);
  }

  if (data.appointmentType !== undefined) {
    normalizedData.appointmentType = normalizeText(data.appointmentType);
  }

  if (data.visitType !== undefined) {
    normalizedData.visitType = normalizeText(data.visitType);
  }

  if (data.appointmentStatus !== undefined) {
    normalizedData.appointmentStatus = normalizeText(data.appointmentStatus);
  }

  if (data.checkInStatus !== undefined) {
    normalizedData.checkInStatus = normalizeText(data.checkInStatus);
  }

  if (data.notes !== undefined) {
    normalizedData.notes = normalizeText(data.notes);
  }

  if (data.referral) {
    normalizedData.referral = {
      ...data.referral,
      referralNumber: normalizeText(data.referral.referralNumber),
      validFrom: normalizeDate(data.referral.validFrom),
      validTo: normalizeDate(data.referral.validTo),
    };
  }

  normalizedData.appointmentStart = buildAppointmentStart(normalizedData.appointmentDate, normalizedData.appointmentTime);
  return normalizedData;
}

function mergeAppointmentState(currentItem: any, nextData: any) {
  const mergedAppointment = {
    ...currentItem,
    ...nextData,
    referral: {
      ...(currentItem.referral ?? {}),
      ...(nextData.referral ?? {}),
    },
    estimate: {
      ...(currentItem.estimate ?? {}),
      ...(nextData.estimate ?? {}),
    },
  };

  mergedAppointment.appointmentStart = buildAppointmentStart(
    mergedAppointment.appointmentDate,
    mergedAppointment.appointmentTime,
  );

  return mergedAppointment;
}

async function maybeCreateEncounterForCheckedInAppointment(
  previousAppointment: any,
  nextAppointment: any,
  locale: string,
  updatedBy: string
) {
  const encounterStartStatuses = new Set([APPOINTMENT_CHECKED_IN_STATUS, APPOINTMENT_IN_PROGRESS_STATUS]);
  const wasCheckedIn = encounterStartStatuses.has(previousAppointment?.appointmentStatus);
  const isCheckedIn = encounterStartStatuses.has(nextAppointment.appointmentStatus);

  if (!isCheckedIn) {
    return null;
  }

  if (previousAppointment && wasCheckedIn) {
    return null;
  }

  return encounterService.createFromAppointment(nextAppointment, locale, updatedBy);
}

function assertManualAppointmentWorkflowStatusAllowed(
  previousAppointment: any,
  nextAppointment: any
) {
  const previousAppointmentStatus = previousAppointment?.appointmentStatus;
  const nextAppointmentStatus = nextAppointment?.appointmentStatus;
  const previousCheckInStatus = previousAppointment?.checkInStatus;
  const nextCheckInStatus = nextAppointment?.checkInStatus;

  if (
    nextAppointmentStatus
    && nextAppointmentStatus !== previousAppointmentStatus
    && SYSTEM_MANAGED_APPOINTMENT_STATUSES.has(nextAppointmentStatus)
  ) {
    throw buildValidationError(
      'Use the appointment check-in and encounter completion workflow instead of manually setting this appointment status.'
    );
  }

  if (
    nextCheckInStatus
    && nextCheckInStatus !== previousCheckInStatus
    && SYSTEM_MANAGED_CHECK_IN_STATUSES.has(nextCheckInStatus)
  ) {
    throw buildValidationError(
      'Use the appointment check-in and encounter completion workflow instead of manually setting this check-in status.'
    );
  }
}

export const appointmentService = {
  async reconcileCompletedAppointmentStatuses(updatedBy?: string) {
    const completedEncounters = await Encounter.find({
      appointmentId: { $exists: true, $ne: null },
      visitStatus: 'Completed',
      isDeleted: false,
      active: true,
    }).select('appointmentId startTime endTime').lean();

    if (!completedEncounters.length) {
      return 0;
    }

    const encounterByAppointmentId = new Map(
      completedEncounters.map((encounter) => [String(encounter.appointmentId), encounter])
    );
    const appointmentIds = Array.from(encounterByAppointmentId.keys());
    const appointments = await Appointment.find({
      _id: { $in: appointmentIds },
      appointmentStatus: { $ne: 'Completed' },
      isDeleted: false,
      active: true,
    });

    for (const appointment of appointments) {
      const encounter = encounterByAppointmentId.get(String(appointment._id));

      appointment.appointmentStatus = 'Completed';
      appointment.checkInStatus = 'Checked Out';
      appointment.checkOutTime = appointment.checkOutTime ?? normalizeDate(encounter?.endTime) ?? new Date();
      appointment.checkInTime = appointment.checkInTime ?? normalizeDate(encounter?.startTime);
      appointment.statusHistory = appendStatusHistory(
        appointment.statusHistory,
        'Completed',
        updatedBy ?? String(appointment.updatedBy ?? appointment.createdBy ?? ''),
        'Workflow reconciliation from completed encounter'
      );
      if (updatedBy) {
        appointment.updatedBy = updatedBy as any;
      }
      appointment.updated = new Date();
      await appointment.save();
    }

    return appointments.length;
  },

  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeAppointmentData(data);
    const candidate = {
      ...normalizedData,
      appointmentStatus: normalizedData.appointmentStatus ?? 'Scheduled',
      checkInStatus: normalizedData.checkInStatus ?? 'Pending',
      noShowFlag: normalizedData.noShowFlag ?? false,
      referral: {
        required: false,
        ...(normalizedData.referral ?? {}),
      },
      estimate: {
        depositCollected: false,
        ...(normalizedData.estimate ?? {}),
      },
    };

    candidate.appointmentStart = buildAppointmentStart(candidate.appointmentDate, candidate.appointmentTime);

    assertManualAppointmentWorkflowStatusAllowed(undefined, candidate);
    validateAppointmentWorkflow(candidate);
    await validateAppointmentReferences(candidate);

    const item = await Appointment.create({
      ...candidate,
      statusHistory: appendStatusHistory(undefined, candidate.appointmentStatus, createdBy, 'Appointment created'),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    if (item.appointmentStatus === APPOINTMENT_CHECKED_IN_STATUS) {
      await encounterService.createFromAppointment(item, locale, createdBy);
    }

    try {
      const activePolicy = await resolvePrimaryInsurancePolicy(item.patientId);

      if (activePolicy) {
        const payer = await resolvePayerByReference(activePolicy.payerId);
        if (payer?.eligibilityApiSupported) {
          await eligibilityVerificationService.runRealtimeVerification(
            {
              appointmentId: String(item._id),
              insuranceId: String(activePolicy._id),
              serviceTypeCode: '30',
            },
            locale,
            { _id: createdBy }
          );
        }
      }
    } catch (err) {
      console.warn(`Eligibility check failed for new appointment ${item._id}: ${getErrorMessage(err)}`);
    }

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Appointment.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('appointment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async getSummary(filter: Record<string, unknown>): Promise<AppointmentSummary> {
    const appointments = await Appointment.find(filter)
      .select('_id patientId providerId facilityId appointmentStatus appointmentStart appointmentDate referral')
      .lean();

    const summary: AppointmentSummary = {
      awaitingArrival: 0,
      inClinic: 0,
      completed: 0,
      exceptions: 0,
      financialHold: 0,
    };

    for (const appointment of appointments) {
      if (['Scheduled', 'Confirmed'].includes(appointment.appointmentStatus ?? '')) {
        summary.awaitingArrival += 1;
      }

      if ([APPOINTMENT_CHECKED_IN_STATUS, APPOINTMENT_IN_PROGRESS_STATUS].includes(appointment.appointmentStatus ?? '')) {
        summary.inClinic += 1;
      }

      if (appointment.appointmentStatus === 'Completed') {
        summary.completed += 1;
      }

      if ([CANCELLED_STATUS, NO_SHOW_STATUS].includes(appointment.appointmentStatus ?? '')) {
        summary.exceptions += 1;
      }

      if (!isAppointmentCheckInStatusEligible(appointment)) {
        continue;
      }

      try {
        await ensureCheckInFinancialClearance(appointment);
      } catch (error) {
        summary.financialHold += 1;
      }
    }

    return summary;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await this.getById(id, locale);
    const previousSnapshot = item.toObject();
    const previousStatus = item.appointmentStatus;
    const normalizedData = normalizeAppointmentData(data);
    const candidate = mergeAppointmentState(previousSnapshot, normalizedData);

    assertManualAppointmentWorkflowStatusAllowed(previousSnapshot, candidate);
    validateAppointmentWorkflow(candidate);
    await validateAppointmentReferences(candidate);

    Object.assign(item, {
      ...normalizedData,
      statusHistory:
        normalizedData.appointmentStatus && normalizedData.appointmentStatus !== previousStatus
          ? appendStatusHistory(
            item.statusHistory,
            normalizedData.appointmentStatus,
            updatedBy,
            'Appointment updated'
          )
          : item.statusHistory,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    await maybeCreateEncounterForCheckedInAppointment(previousSnapshot, item.toObject(), locale, updatedBy);

    return item;
  },

  async checkIn(id: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Appointment.findOne({ _id: id, isDeleted: false }).session(session);

    if (!item) {
      throw new AppError(t('appointment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if ([CANCELLED_STATUS, NO_SHOW_STATUS].includes(item.appointmentStatus ?? '')) {
      throw buildValidationError('Cancelled or No Show appointments cannot be checked in.');
    }

    if ([APPOINTMENT_CHECKED_IN_STATUS, APPOINTMENT_IN_PROGRESS_STATUS, 'Completed'].includes(item.appointmentStatus ?? '')) {
      throw buildValidationError('Appointment has already moved past check-in.');
    }

    await ensureCheckInFinancialClearance(item);

    item.appointmentStatus = APPOINTMENT_CHECKED_IN_STATUS;
    item.checkInStatus = APPOINTMENT_CHECKED_IN_STATUS;
    item.checkInTime = item.checkInTime ?? new Date();
    item.statusHistory = appendStatusHistory(
      item.statusHistory,
      item.appointmentStatus,
      updatedBy,
      'Patient checked in'
    );
    item.updatedBy = updatedBy;
    item.updated = new Date();

    await item.save({ session });

    const encounter = await encounterService.createFromAppointment(item, locale, updatedBy, { session });

    item.appointmentStatus = APPOINTMENT_IN_PROGRESS_STATUS;
    item.statusHistory = appendStatusHistory(
      item.statusHistory,
      item.appointmentStatus,
      updatedBy,
      'Encounter started after patient check-in'
    );
    item.updatedBy = updatedBy;
    item.updated = new Date();
    await item.save({ session });

    return {
      appointment: item,
      encounter,
    };
    });
  },

  async bulkUpdate(ids: string[], data: any, locale: string, updatedBy: string) {
    const items = await Appointment.find({ _id: { $in: ids }, isDeleted: false });

    if (items.length !== ids.length) {
      throw new AppError(t('appointment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const updatedItems = [];

    for (const item of items) {
      const previousSnapshot = item.toObject();
      const previousStatus = item.appointmentStatus;
      const normalizedData = normalizeAppointmentData(data);
      const candidate = mergeAppointmentState(previousSnapshot, normalizedData);

      validateAppointmentWorkflow(candidate);
      await validateAppointmentReferences(candidate);

      Object.assign(item, {
        ...normalizedData,
        statusHistory:
          normalizedData.appointmentStatus && normalizedData.appointmentStatus !== previousStatus
            ? appendStatusHistory(
              item.statusHistory,
              normalizedData.appointmentStatus,
              updatedBy,
              'Bulk appointment update'
            )
            : item.statusHistory,
        updatedBy,
        updated: new Date(),
      });

      await item.save();
      await maybeCreateEncounterForCheckedInAppointment(previousSnapshot, item.toObject(), locale, updatedBy);
      updatedItems.push(item);
    }

    return updatedItems;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await Appointment.findOneAndUpdate(
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
      throw new AppError(t('appointment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
