import { Patient } from './patient.model';
import mongoose from 'mongoose';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { markEntityDocumentsDeleted, syncEntityDocuments } from '../document/document-registry.service';

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeEmail(value: unknown) {
  const email = normalizeText(value);
  return email ? email.toLowerCase() : undefined;
}

function normalizePhoneDigits(value: unknown) {
  const phoneNumber = normalizeText(value);
  const digits = phoneNumber?.replace(/\D+/g, '');
  return digits ? digits : undefined;
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

function hasAnyValue(record: Record<string, unknown>) {
  return Object.values(record).some((value) => {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  });
}

function normalizeAddress(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const address = value as Record<string, unknown>;
  const nextAddress = {
    addressLine1: normalizeText(address.addressLine1),
    addressLine2: normalizeText(address.addressLine2),
    city: normalizeText(address.city),
    state: normalizeText(address.state),
    zipCode: normalizeText(address.zipCode),
    country: normalizeText(address.country),
  };

  return hasAnyValue(nextAddress) ? nextAddress : undefined;
}

function normalizeGuarantor(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const guarantor = value as Record<string, unknown>;
  const nextGuarantor = {
    firstName: normalizeText(guarantor.firstName),
    lastName: normalizeText(guarantor.lastName),
    relationshipToPatient: normalizeText(guarantor.relationshipToPatient),
    phone: normalizeText(guarantor.phone),
    email: normalizeEmail(guarantor.email),
    addressLine1: normalizeText(guarantor.addressLine1),
    addressLine2: normalizeText(guarantor.addressLine2),
    city: normalizeText(guarantor.city),
    state: normalizeText(guarantor.state),
    zipCode: normalizeText(guarantor.zipCode),
  };

  return hasAnyValue(nextGuarantor) ? nextGuarantor : undefined;
}

function normalizeEmergencyContacts(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((contact): contact is Record<string, unknown> => typeof contact === 'object' && contact !== null)
    .map((contact) => ({
      firstName: normalizeText(contact.firstName),
      lastName: normalizeText(contact.lastName),
      relationship: normalizeText(contact.relationship),
      phone: normalizeText(contact.phone),
      email: normalizeEmail(contact.email),
    }))
    .filter((contact) => hasAnyValue(contact));
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((attachment): attachment is Record<string, unknown> => typeof attachment === 'object' && attachment !== null)
    .map((attachment) => ({
      documentType: normalizeText(attachment.documentType),
      title: normalizeText(attachment.title),
      fileUrl: normalizeText(attachment.fileUrl),
      description: normalizeText(attachment.description),
    }))
    .filter((attachment) => hasAnyValue(attachment));
}

function buildPatientDocumentAttachments(patient: any) {
  return (patient.attachments ?? []).map((attachment: any) => ({
    ...attachment,
    sourceTag: 'source:patient-attachments',
  }));
}

function normalizePatientData(data: any) {
  const normalizedData = { ...data };

  if ('medicalRecordNumber' in data) {
    normalizedData.medicalRecordNumber = normalizeText(data.medicalRecordNumber);
  }

  if ('firstName' in data) {
    normalizedData.firstName = normalizeText(data.firstName);
  }

  if ('middleName' in data) {
    normalizedData.middleName = normalizeText(data.middleName);
  }

  if ('lastName' in data) {
    normalizedData.lastName = normalizeText(data.lastName);
  }

  if ('suffix' in data) {
    normalizedData.suffix = normalizeText(data.suffix);
  }

  if ('dateOfBirth' in data) {
    normalizedData.dateOfBirth = normalizeDate(data.dateOfBirth);
  }

  if ('gender' in data) {
    normalizedData.gender = normalizeText(data.gender);
  }

  if ('sex' in data) {
    normalizedData.sex = normalizeText(data.sex);
  }

  if ('maritalStatus' in data) {
    normalizedData.maritalStatus = normalizeText(data.maritalStatus);
  }

  if ('mobileNumber' in data) {
    normalizedData.mobileNumber = normalizeText(data.mobileNumber);
  }

  if ('alternatePhoneNumber' in data) {
    normalizedData.alternatePhoneNumber = normalizeText(data.alternatePhoneNumber);
  }

  if ('email' in data) {
    normalizedData.email = normalizeEmail(data.email);
  }

  if ('preferredLanguage' in data) {
    normalizedData.preferredLanguage = normalizeText(data.preferredLanguage);
  }

  if ('interpreterRequired' in data) {
    normalizedData.interpreterRequired = Boolean(data.interpreterRequired);
  }

  if ('race' in data) {
    normalizedData.race = normalizeText(data.race);
  }

  if ('ethnicity' in data) {
    normalizedData.ethnicity = normalizeText(data.ethnicity);
  }

  if ('patientStatus' in data) {
    normalizedData.patientStatus = normalizeText(data.patientStatus);
  }

  if ('ssnLast4' in data) {
    normalizedData.ssnLast4 = normalizeText(data.ssnLast4);
  }

  if ('employmentStatus' in data) {
    normalizedData.employmentStatus = normalizeText(data.employmentStatus);
  }

  if ('employerName' in data) {
    normalizedData.employerName = normalizeText(data.employerName);
  }

  if ('preferredCommunicationMethod' in data) {
    normalizedData.preferredCommunicationMethod = normalizeText(data.preferredCommunicationMethod);
  }

  if ('deceased' in data) {
    normalizedData.deceased = Boolean(data.deceased);
  }

  if ('dateOfDeath' in data) {
    normalizedData.dateOfDeath = normalizeDate(data.dateOfDeath);
  }

  if ('address' in data) {
    normalizedData.address = normalizeAddress(data.address);
  }

  if ('guarantor' in data) {
    normalizedData.guarantor = normalizeGuarantor(data.guarantor);
  }

  if ('emergencyContacts' in data) {
    normalizedData.emergencyContacts = normalizeEmergencyContacts(data.emergencyContacts) ?? [];
  }

  if ('attachments' in data) {
    normalizedData.attachments = normalizeAttachments(data.attachments) ?? [];
  }

  return normalizedData;
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function buildMedicalRecordNumberConflict(locale: string) {
  return new AppError(t('patient.medicalRecordNumberExists', {}, locale), HTTP_STATUS.CONFLICT, [
    {
      field: 'medicalRecordNumber',
      message: 'Medical record number already exists',
    },
  ]);
}

function calculateDuplicateScore(candidate: any, match: any) {
  let score = 0;

  if (normalizeText(candidate.firstName)?.toLowerCase() === normalizeText(match.firstName)?.toLowerCase()) {
    score += 25;
  }

  if (normalizeText(candidate.lastName)?.toLowerCase() === normalizeText(match.lastName)?.toLowerCase()) {
    score += 25;
  }

  if (normalizeDate(candidate.dateOfBirth)?.toDateString() === normalizeDate(match.dateOfBirth)?.toDateString()) {
    score += 25;
  }

  if (normalizeEmail(candidate.email) && normalizeEmail(candidate.email) === normalizeEmail(match.email)) {
    score += 15;
  }

  if (
    normalizePhoneDigits(candidate.mobileNumber)
    && (
      normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.mobileNumber)
      || normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.alternatePhoneNumber)
    )
  ) {
    score += 15;
  }

  if (
    normalizeText(candidate.address?.addressLine1)?.toLowerCase()
    && normalizeText(candidate.address?.zipCode)?.toLowerCase()
    && normalizeText(candidate.address?.addressLine1)?.toLowerCase() === normalizeText(match.address?.addressLine1)?.toLowerCase()
    && normalizeText(candidate.address?.zipCode)?.toLowerCase() === normalizeText(match.address?.zipCode)?.toLowerCase()
  ) {
    score += 10;
  }

  return Math.min(score, 100);
}

function buildDuplicateReasons(candidate: any, match: any) {
  const reasons: string[] = [];

  if (normalizeText(candidate.firstName)?.toLowerCase() === normalizeText(match.firstName)?.toLowerCase()) {
    reasons.push('First name match');
  }

  if (normalizeText(candidate.lastName)?.toLowerCase() === normalizeText(match.lastName)?.toLowerCase()) {
    reasons.push('Last name match');
  }

  if (normalizeDate(candidate.dateOfBirth)?.toDateString() === normalizeDate(match.dateOfBirth)?.toDateString()) {
    reasons.push('Date of birth match');
  }

  if (normalizeEmail(candidate.email) && normalizeEmail(candidate.email) === normalizeEmail(match.email)) {
    reasons.push('Email match');
  }

  if (
    normalizePhoneDigits(candidate.mobileNumber)
    && (
      normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.mobileNumber)
      || normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.alternatePhoneNumber)
    )
  ) {
    reasons.push('Phone match');
  }

  return reasons.length ? reasons : ['Same DOB with partial demographic overlap'];
}

const PATIENT_REFERENCE_COLLECTIONS = [
  'insurancepolicies',
  'eligibilityverifications',
  'appointments',
  'referrals',
  'priorauthorizations',
  'encounters',
  'charges',
  'codingreviews',
  'claims',
  'claimaireviews',
  'claimsubmissions',
  'claimtrackings',
  'patientbillings',
  'patientpayments',
  'collections',
  'denials',
  'appeals',
  'arworkitems',
  'paymentpostings',
  'eraeobprocessings',
  'adjustments',
  'refunds',
  'documents',
  'tasks',
];

function buildDayRange(dateValue: Date) {
  const start = new Date(dateValue);
  start.setHours(0, 0, 0, 0);

  const end = new Date(dateValue);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function hasStrongDuplicateSignal(candidate: any, match: any) {
  const sameFirstName = normalizeText(candidate.firstName)?.toLowerCase() === normalizeText(match.firstName)?.toLowerCase();
  const sameLastName = normalizeText(candidate.lastName)?.toLowerCase() === normalizeText(match.lastName)?.toLowerCase();
  const sameEmail = normalizeEmail(candidate.email) && normalizeEmail(candidate.email) === normalizeEmail(match.email);
  const sameMobile =
    normalizePhoneDigits(candidate.mobileNumber)
    && (
      normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.mobileNumber)
      || normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.alternatePhoneNumber)
    );
  const sameAddress =
    normalizeText(candidate.address?.addressLine1)?.toLowerCase()
    && normalizeText(candidate.address?.zipCode)?.toLowerCase()
    && normalizeText(candidate.address?.addressLine1)?.toLowerCase() === normalizeText(match.address?.addressLine1)?.toLowerCase()
    && normalizeText(candidate.address?.zipCode)?.toLowerCase() === normalizeText(match.address?.zipCode)?.toLowerCase();

  return Boolean(sameLastName && ((sameFirstName && (sameMobile || sameEmail)) || (sameFirstName && sameAddress)));
}

async function deriveAutomationFlags(candidate: any, excludeId?: string) {
  if (!(candidate.dateOfBirth instanceof Date) || Number.isNaN(candidate.dateOfBirth.getTime())) {
    return {
      duplicateCheckFlag: false,
      mergeRequiredFlag: false,
    };
  }

  const { start, end } = buildDayRange(candidate.dateOfBirth);
  const possibleMatches = await Patient.find({
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    dateOfBirth: {
      $gte: start,
      $lte: end,
    },
  }).select('firstName lastName email mobileNumber alternatePhoneNumber address');

  const duplicateCandidates = possibleMatches.filter((match) => {
    const sameLastName = normalizeText(candidate.lastName)?.toLowerCase() === normalizeText(match.lastName)?.toLowerCase();
    const sameEmail = normalizeEmail(candidate.email) && normalizeEmail(candidate.email) === normalizeEmail(match.email);
    const sameMobile =
      normalizePhoneDigits(candidate.mobileNumber)
      && (
        normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.mobileNumber)
        || normalizePhoneDigits(candidate.mobileNumber) === normalizePhoneDigits(match.alternatePhoneNumber)
      );

    return Boolean(sameLastName || sameEmail || sameMobile);
  });

  return {
    duplicateCheckFlag: duplicateCandidates.length > 0,
    mergeRequiredFlag: duplicateCandidates.some((match) => hasStrongDuplicateSignal(candidate, match)),
  };
}

function validatePatientState(candidate: any) {
  if (!(candidate.dateOfBirth instanceof Date) || Number.isNaN(candidate.dateOfBirth.getTime())) {
    throw buildValidationError('Date of birth is required.');
  }

  if (candidate.deceased === true) {
    if (!(candidate.dateOfDeath instanceof Date) || Number.isNaN(candidate.dateOfDeath.getTime())) {
      throw buildValidationError('Date of death is required when the patient is marked deceased.');
    }
  } else {
    candidate.dateOfDeath = undefined;
  }

  if (
    candidate.dateOfDeath instanceof Date &&
    candidate.dateOfBirth instanceof Date &&
    candidate.dateOfDeath < candidate.dateOfBirth
  ) {
    throw buildValidationError('Date of death cannot be before date of birth.');
  }
}

export const patientService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizePatientData(data);
    const existingPatient = await Patient.findOne({
      medicalRecordNumber: normalizedData.medicalRecordNumber,
      isDeleted: false,
    });

    if (existingPatient) {
      throw buildMedicalRecordNumberConflict(locale);
    }

    validatePatientState(normalizedData);
    const automationFlags = await deriveAutomationFlags(normalizedData);

    const patient = await Patient.create({
      ...normalizedData,
      ...automationFlags,
      email: normalizedData.email,
      patientStatus: normalizedData.patientStatus || 'Active',
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    await syncEntityDocuments({
      entityType: 'patient',
      entityId: String(patient._id),
      patientId: String(patient._id),
      attachments: buildPatientDocumentAttachments(patient),
      sourceTags: ['source:patient-attachments'],
      userId: createdBy,
    });

    return patient;
  },

  async getById(id: string, locale: string) {
    const patient = await Patient.findOne({ _id: id, isDeleted: false });

    if (!patient) {
      throw new AppError(t('patient.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return patient;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const patient = await Patient.findOne({ _id: id, isDeleted: false });

    if (!patient) {
      throw new AppError(t('patient.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const normalizedData = normalizePatientData(data);

    if (
      normalizedData.medicalRecordNumber &&
      normalizedData.medicalRecordNumber !== patient.medicalRecordNumber
    ) {
      const existingPatient = await Patient.findOne({
        _id: { $ne: id },
        medicalRecordNumber: normalizedData.medicalRecordNumber,
        isDeleted: false,
      });

      if (existingPatient) {
        throw buildMedicalRecordNumberConflict(locale);
      }
    }

    const candidate = {
      ...patient.toObject(),
      ...normalizedData,
    };

    validatePatientState(candidate);
    const automationFlags = await deriveAutomationFlags(candidate, id);

    Object.assign(patient, {
      ...normalizedData,
      ...automationFlags,
      dateOfDeath: candidate.dateOfDeath,
      updatedBy,
      updated: new Date(),
    });

    await patient.save();

    await syncEntityDocuments({
      entityType: 'patient',
      entityId: String(patient._id),
      patientId: String(patient._id),
      attachments: buildPatientDocumentAttachments(patient),
      sourceTags: ['source:patient-attachments'],
      userId: updatedBy,
    });

    return patient;
  },

  async getDuplicateCandidates(id: string, locale: string) {
    const patient = await this.getById(id, locale);
    const normalizedDob = normalizeDate(patient.dateOfBirth);
    const filter: Record<string, unknown> = {
      _id: { $ne: id },
      isDeleted: false,
      active: true,
    };

    if (normalizedDob) {
      const { start, end } = buildDayRange(normalizedDob);
      filter.dateOfBirth = { $gte: start, $lte: end };
    }

    const candidates = await Patient.find(filter)
      .limit(25)
      .sort({ updated: -1 })
      .select('medicalRecordNumber firstName lastName dateOfBirth email mobileNumber alternatePhoneNumber address duplicateCheckFlag mergeRequiredFlag patientStatus');

    return candidates
      .map((candidate) => ({
        patient: candidate,
        matchScore: calculateDuplicateScore(patient, candidate),
        reasons: buildDuplicateReasons(patient, candidate),
        recommendedAction:
          calculateDuplicateScore(patient, candidate) >= 75
            ? 'Merge duplicate record after confirming demographics.'
            : 'Review manually before marking as unique.',
      }))
      .filter((candidate) => candidate.matchScore >= 35)
      .sort((left, right) => right.matchScore - left.matchScore);
  },

  async markNotDuplicate(id: string, locale: string, updatedBy: string) {
    const patient = await this.getById(id, locale);

    patient.duplicateCheckFlag = false;
    patient.mergeRequiredFlag = false;
    patient.duplicateOfPatientId = undefined;
    patient.updatedBy = updatedBy;
    patient.updated = new Date();
    await patient.save();

    return patient;
  },

  async mergeDuplicate(
    primaryPatientId: string,
    duplicatePatientId: string,
    locale: string,
    updatedBy: string,
    notes?: string
  ) {
    if (primaryPatientId === duplicatePatientId) {
      throw buildValidationError('Primary and duplicate patient must be different records.');
    }

    const [primaryPatient, duplicatePatient] = await Promise.all([
      this.getById(primaryPatientId, locale),
      this.getById(duplicatePatientId, locale),
    ]);

    const duplicateObjectId = new mongoose.Types.ObjectId(duplicatePatientId);
    const primaryObjectId = new mongoose.Types.ObjectId(primaryPatientId);

    await Promise.all(
      PATIENT_REFERENCE_COLLECTIONS.map((collectionName) =>
        mongoose.connection.collection(collectionName).updateMany(
          { patientId: duplicateObjectId },
          { $set: { patientId: primaryObjectId, updated: new Date(), updatedBy } }
        )
      )
    );

    primaryPatient.duplicateCheckFlag = false;
    primaryPatient.mergeRequiredFlag = false;
    primaryPatient.updatedBy = updatedBy;
    primaryPatient.updated = new Date();
    await primaryPatient.save();

    duplicatePatient.active = false;
    duplicatePatient.isDeleted = true;
    duplicatePatient.deletedAt = new Date();
    duplicatePatient.patientStatus = 'Merged';
    duplicatePatient.mergedIntoPatientId = primaryObjectId;
    duplicatePatient.mergedAt = new Date();
    duplicatePatient.mergeNotes = notes;
    duplicatePatient.updatedBy = updatedBy;
    duplicatePatient.updated = new Date();
    await duplicatePatient.save();

    return {
      primaryPatient,
      duplicatePatient,
      mergedCollections: PATIENT_REFERENCE_COLLECTIONS,
    };
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const patient = await Patient.findOneAndUpdate(
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

    if (!patient) {
      throw new AppError(t('patient.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    await markEntityDocumentsDeleted('patient', id, updatedBy);

    return true;
  },
};
