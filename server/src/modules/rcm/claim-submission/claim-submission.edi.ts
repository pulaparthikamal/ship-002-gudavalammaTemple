import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

type AddressLike = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

type ClaimLineLike = {
  lineNumber?: number;
  cptCode?: string;
  modifiers?: string[];
  icdPointers?: number[];
  units?: number;
  chargeAmount?: number;
  placeOfService?: string;
  serviceDateFrom?: Date;
  serviceDateTo?: Date;
  authorizationRequired?: boolean;
  referralRequired?: boolean;
  priorAuthorizationNumber?: string;
  referralNumber?: string;
};

type ClaimLike = {
  _id: string;
  claimType?: string;
  coveragePriority?: string;
  frequencyCode?: string;
  claimDate?: Date;
  totalChargeAmount?: number;
  diagnosisCodes?: string[];
  claimLines: ClaimLineLike[];
};

type PatientLike = {
  medicalRecordNumber?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: string;
  sex?: string;
  address?: AddressLike;
};

type SubscriberLike = AddressLike & {
  firstName?: string;
  lastName?: string;
  dob?: Date;
  gender?: string;
};

type InsurancePolicyLike = {
  memberId?: string;
  groupNumber?: string;
  relationshipToSubscriber?: string;
  planName?: string;
  payerId?: string;
  ediPayerId?: string;
  subscriber?: SubscriberLike;
};

type PayerLike = {
  payerName?: string;
  ediPayerId?: string;
};

type ProviderLike = {
  firstName?: string;
  lastName?: string;
  npi?: string;
  taxonomyCode?: string;
  taxId?: string;
};

type FacilityLike = AddressLike & {
  facilityName?: string;
  npi?: string;
  taxId?: string;
  placeOfServiceCode?: string;
};

export type ClaimSubmissionEdiContext = {
  claim: ClaimLike;
  patient: PatientLike;
  insurancePolicy: InsurancePolicyLike;
  payer: PayerLike;
  billingProvider: ProviderLike;
  renderingProvider: ProviderLike;
  facility: FacilityLike;
};

export type ClaimSubmissionEdiOptions = {
  senderId: string;
  receiverId: string;
  submitterId: string;
  submitterName: string;
  receiverName: string;
  contactName: string;
  contactPhone: string;
  usageIndicator: string;
  interchangeControlNumber: string;
  groupControlNumber: string;
  transactionSetControlNumber: string;
  claimControlNumber: string;
};

export type ClaimSubmissionEdiBuildError = {
  field: string;
  message: string;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value: unknown) {
  return normalizeText(value).replace(/\D+/g, '');
}

function buildStructuredValidationError(errors: ClaimSubmissionEdiBuildError[]) {
  return new AppError(
    `837P cannot be built because required claim data is missing: ${errors.map((error) => error.message).join('; ')}`,
    HTTP_STATUS.BAD_REQUEST,
    errors
  );
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function formatDate(value?: Date) {
  if (!value) {
    return '';
  }

  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatTime(value?: Date) {
  if (!value) {
    return '';
  }

  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

function formatAmount(value: unknown) {
  return (typeof value === 'number' && Number.isFinite(value) ? value : 0).toFixed(2);
}

function isPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatZipCode(value: unknown) {
  return normalizeDigits(value).slice(0, 9);
}

function formatPhone(value: unknown) {
  return normalizeDigits(value).slice(0, 10);
}

function mapGenderCode(value: unknown) {
  const normalizedValue = normalizeText(value).toUpperCase();

  if (normalizedValue.startsWith('F')) {
    return 'F';
  }

  if (normalizedValue.startsWith('M')) {
    return 'M';
  }

  return 'U';
}

function mapRelationshipCode(value: unknown) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue || normalizedValue === 'self') {
    return '18';
  }

  if (normalizedValue === 'spouse') {
    return '01';
  }

  if (normalizedValue === 'child') {
    return '19';
  }

  return 'G8';
}

function mapCoverageCode(value: unknown) {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case 'secondary':
      return 'S';
    case 'tertiary':
      return 'T';
    default:
      return 'P';
  }
}

function buildName(firstName?: string, lastName?: string) {
  return {
    firstName: normalizeText(firstName).slice(0, 25),
    lastName: normalizeText(lastName).slice(0, 35),
  };
}

function getClaimServiceDate(claim: ClaimLike) {
  const lineServiceDate = normalizeDate(claim.claimLines[0]?.serviceDateFrom);
  return lineServiceDate ?? normalizeDate(claim.claimDate) ?? new Date();
}

function buildDiagnosisSegments(diagnosisCodes: string[]) {
  return diagnosisCodes
    .map((code, index) => `${index === 0 ? 'ABK' : 'ABF'}:${code.replace(/\./g, '').slice(0, 12)}`)
    .join('*');
}

function buildServiceLineProcedure(line: ClaimLineLike) {
  const procedureCode = normalizeText(line.cptCode).slice(0, 5);
  const modifiers = (line.modifiers ?? [])
    .map((value) => normalizeText(value).slice(0, 2))
    .filter(Boolean)
    .slice(0, 4);

  return ['HC', procedureCode, ...modifiers].join(':');
}

function buildDiagnosisPointers(line: ClaimLineLike) {
  const pointers = (line.icdPointers ?? [])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => String(value));

  if (!pointers.length) {
    throw new AppError('Claim line diagnosis pointers are required for electronic claim submission.', HTTP_STATUS.BAD_REQUEST);
  }

  return pointers.join(':');
}

function validateContext(context: ClaimSubmissionEdiContext, options: ClaimSubmissionEdiOptions) {
  const errors: ClaimSubmissionEdiBuildError[] = [];
  const requireText = (value: unknown, field: string, message: string) => {
    if (!normalizeText(value)) {
      errors.push({ field, message: `${message} is required for electronic claim submission.` });
    }
  };
  const requireFormatted = (value: string, field: string, message: string) => {
    if (!value) {
      errors.push({ field, message: `${message} is required for electronic claim submission.` });
    }
  };
  const requirePositive = (value: unknown, field: string, message: string) => {
    if (!isPositiveNumber(value)) {
      errors.push({ field, message: `${message} must be greater than zero for electronic claim submission.` });
    }
  };

  if (normalizeText(context.claim.claimType) && context.claim.claimType !== 'Professional') {
    throw new AppError(
      'Electronic claim submission currently supports professional 837P claims only.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  requireText(context.patient.firstName, 'patient.firstName', 'Patient first name');
  requireText(context.patient.lastName, 'patient.lastName', 'Patient last name');
  requireFormatted(formatDate(normalizeDate(context.patient.dateOfBirth)), 'patient.dateOfBirth', 'Patient date of birth');
  requireText(context.patient.sex || context.patient.gender, 'patient.gender', 'Patient gender/sex');
  requireText(context.patient.address?.addressLine1, 'patient.address.addressLine1', 'Patient address');
  requireText(context.patient.address?.city, 'patient.address.city', 'Patient city');
  requireText(context.patient.address?.state, 'patient.address.state', 'Patient state');
  requireFormatted(formatZipCode(context.patient.address?.zipCode), 'patient.address.zipCode', 'Patient ZIP code');

  requireText(context.insurancePolicy.memberId, 'insurancePolicy.memberId', 'Subscriber/member ID');
  requireText(context.payer.payerName, 'payer.payerName', 'Payer name');
  requireText(
    normalizeText(context.insurancePolicy.ediPayerId) || normalizeText(context.payer.ediPayerId),
    'payer.ediPayerId',
    'EDI payer ID'
  );

  requireText(context.billingProvider.npi, 'billingProvider.npi', 'Billing provider NPI');
  requireText(
    context.billingProvider.taxonomyCode || context.renderingProvider.taxonomyCode,
    'billingProvider.taxonomyCode',
    'Billing or rendering provider taxonomy code'
  );
  requireText(context.renderingProvider.npi, 'renderingProvider.npi', 'Rendering provider NPI');
  requireText(context.renderingProvider.lastName, 'renderingProvider.lastName', 'Rendering provider last name');
  requireFormatted(formatPhone(options.contactPhone), 'options.contactPhone', 'Submitter contact phone');

  requireText(context.facility.facilityName, 'facility.facilityName', 'Facility name');
  requireText(context.facility.npi, 'facility.npi', 'Facility/service location NPI');
  requireFormatted(normalizeDigits(context.billingProvider.taxId) || normalizeDigits(context.facility.taxId), 'billingProvider.taxId', 'Billing provider Tax ID');
  requireText(context.facility.placeOfServiceCode, 'facility.placeOfServiceCode', 'Facility place of service');
  requireText(context.facility.addressLine1, 'facility.addressLine1', 'Facility address');
  requireText(context.facility.city, 'facility.city', 'Facility city');
  requireText(context.facility.state, 'facility.state', 'Facility state');
  requireFormatted(formatZipCode(context.facility.zipCode), 'facility.zipCode', 'Facility ZIP code');
  requireText(context.claim.frequencyCode, 'claim.frequencyCode', 'Claim frequency code');

  if (!context.claim.claimLines.length) {
    errors.push({
      field: 'claim.claimLines',
      message: 'At least one claim line is required for electronic claim submission.',
    });
  }

  if (!(context.claim.diagnosisCodes ?? []).filter((code) => normalizeText(code)).length) {
    errors.push({
      field: 'claim.diagnosisCodes',
      message: 'Diagnosis codes are required for electronic claim submission.',
    });
  }

  context.claim.claimLines.forEach((line, index) => {
    const lineNumber = line.lineNumber ?? index + 1;
    requireText(line.placeOfService, `claimLines.${index}.placeOfService`, `Claim line ${lineNumber} place of service`);
    requireFormatted(formatDate(normalizeDate(line.serviceDateFrom)), `claimLines.${index}.serviceDateFrom`, `Claim line ${lineNumber} date of service`);
    requireText(line.cptCode, `claimLines.${index}.cptCode`, `Claim line ${lineNumber} CPT code`);
    requirePositive(line.units, `claimLines.${index}.units`, `Claim line ${lineNumber} units`);
    requirePositive(line.chargeAmount, `claimLines.${index}.chargeAmount`, `Claim line ${lineNumber} charge amount`);

    const pointers = (line.icdPointers ?? [])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (!pointers.length) {
      errors.push({
        field: `claimLines.${index}.icdPointers`,
        message: `Claim line ${lineNumber} diagnosis pointers are required for electronic claim submission.`,
      });
    }

    pointers.forEach((pointer) => {
      if (pointer < 1 || pointer > (context.claim.diagnosisCodes ?? []).length) {
        errors.push({
          field: `claimLines.${index}.icdPointers`,
          message: `Claim line ${lineNumber} diagnosis pointer ${pointer} does not match a claim diagnosis code.`,
        });
      }
    });

    if (line.authorizationRequired && !normalizeText(line.priorAuthorizationNumber)) {
      errors.push({
        field: `claimLines.${index}.priorAuthorizationNumber`,
        message: `Claim line ${lineNumber} prior authorization number is required for electronic claim submission.`,
      });
    }

    if (line.referralRequired && !normalizeText(line.referralNumber)) {
      errors.push({
        field: `claimLines.${index}.referralNumber`,
        message: `Claim line ${lineNumber} referral number is required for electronic claim submission.`,
      });
    }
  });

  if (errors.length) {
    throw buildStructuredValidationError(errors);
  }
}

export function build837ProfessionalClaimPayload(
  context: ClaimSubmissionEdiContext,
  options: ClaimSubmissionEdiOptions
) {
  validateContext(context, options);

  const now = new Date();
  const createdDate = formatDate(now);
  const createdTime = formatTime(now);
  const serviceDate = getClaimServiceDate(context.claim);
  const relationshipCode = mapRelationshipCode(context.insurancePolicy.relationshipToSubscriber);
  const subscriberIsPatient = relationshipCode === '18';
  const patientName = buildName(context.patient.firstName, context.patient.lastName);
  const subscriberName = subscriberIsPatient
    ? patientName
    : buildName(context.insurancePolicy.subscriber?.firstName, context.insurancePolicy.subscriber?.lastName);
  const diagnosisCodes = (context.claim.diagnosisCodes ?? [])
    .map((code) => normalizeText(code).replace(/\./g, ''))
    .filter(Boolean)
    .slice(0, 12);
  const billingProviderName = normalizeText(context.billingProvider.lastName)
    ? buildName(context.billingProvider.firstName, context.billingProvider.lastName)
    : buildName(undefined, context.facility.facilityName);
  const renderingProviderName = buildName(context.renderingProvider.firstName, context.renderingProvider.lastName);
  const subscriberDob = subscriberIsPatient
    ? normalizeDate(context.patient.dateOfBirth)
    : normalizeDate(context.insurancePolicy.subscriber?.dob);
  const subscriberGender = subscriberIsPatient
    ? mapGenderCode(context.patient.sex || context.patient.gender)
    : mapGenderCode(context.insurancePolicy.subscriber?.gender);
  const subscriberAddress = subscriberIsPatient
    ? context.patient.address
    : context.insurancePolicy.subscriber;
  const payerId = normalizeText(context.insurancePolicy.ediPayerId) || normalizeText(context.payer.ediPayerId);
  const billingTaxId = normalizeDigits(context.billingProvider.taxId) || normalizeDigits(context.facility.taxId);
  const contactPhone = formatPhone(options.contactPhone);
  const billingTaxonomyCode = normalizeText(context.billingProvider.taxonomyCode || context.renderingProvider.taxonomyCode).slice(0, 10);
  const claimAmount = formatAmount(context.claim.totalChargeAmount);
  const placeOfService = normalizeText(context.claim.claimLines[0]?.placeOfService);
  const frequencyCode = normalizeText(context.claim.frequencyCode);
  const coverageCode = mapCoverageCode(context.claim.coveragePriority);

  const segments: string[] = [
    `ISA*00*          *00*          *ZZ*${options.senderId.padEnd(15, ' ')}*ZZ*${options.receiverId.padEnd(15, ' ')}*${createdDate.slice(2)}*${createdTime}*^*00501*${options.interchangeControlNumber.padStart(9, '0')}*0*${options.usageIndicator}*:`,
    `GS*HC*${options.senderId}*${options.receiverId}*${createdDate}*${createdTime}*${options.groupControlNumber}*X*005010X222A1`,
    `ST*837*${options.transactionSetControlNumber}*005010X222A1`,
    `BHT*0019*00*${options.claimControlNumber}*${createdDate}*${createdTime}*CH`,
    `NM1*41*2*${options.submitterName.slice(0, 60)}*****46*${options.submitterId.slice(0, 80)}`,
    `PER*IC*${options.contactName.slice(0, 60)}*TE*${contactPhone}`,
    `NM1*40*2*${options.receiverName.slice(0, 60)}*****46*${options.receiverId.slice(0, 80)}`,
    'HL*1**20*1',
    `PRV*BI*PXC*${billingTaxonomyCode}`,
    `NM1*85*${normalizeText(context.billingProvider.lastName) ? '1' : '2'}*${billingProviderName.lastName.slice(0, 60)}${billingProviderName.firstName ? `*${billingProviderName.firstName}` : ''}****XX*${normalizeDigits(context.billingProvider.npi || context.facility.npi).slice(0, 10)}`,
    `N3*${normalizeText(context.facility.addressLine1).slice(0, 55)}${normalizeText(context.facility.addressLine2) ? `*${normalizeText(context.facility.addressLine2).slice(0, 55)}` : ''}`,
    `N4*${normalizeText(context.facility.city).slice(0, 30)}*${normalizeText(context.facility.state).slice(0, 2)}*${formatZipCode(context.facility.zipCode)}`,
    `REF*EI*${billingTaxId}`,
    'HL*2*1*22*0',
    `SBR*${coverageCode}*${relationshipCode}*******CI`,
    `NM1*IL*1*${subscriberName.lastName}*${subscriberName.firstName}****MI*${normalizeText(context.insurancePolicy.memberId).slice(0, 80)}`,
    `N3*${normalizeText(subscriberAddress?.addressLine1).slice(0, 55)}${normalizeText(subscriberAddress?.addressLine2) ? `*${normalizeText(subscriberAddress?.addressLine2).slice(0, 55)}` : ''}`,
    `N4*${normalizeText(subscriberAddress?.city).slice(0, 30)}*${normalizeText(subscriberAddress?.state).slice(0, 2)}*${formatZipCode(subscriberAddress?.zipCode)}`,
    `DMG*D8*${formatDate(subscriberDob)}*${subscriberGender}`,
    `NM1*PR*2*${normalizeText(context.payer.payerName).slice(0, 60)}*****PI*${payerId.slice(0, 80)}`,
  ];

  if (!subscriberIsPatient) {
    segments.push('HL*3*2*23*0');
    segments.push(`PAT*${relationshipCode}`);
    segments.push(`NM1*QC*1*${patientName.lastName}*${patientName.firstName}`);
    segments.push(`N3*${normalizeText(context.patient.address?.addressLine1).slice(0, 55)}${normalizeText(context.patient.address?.addressLine2) ? `*${normalizeText(context.patient.address?.addressLine2).slice(0, 55)}` : ''}`);
    segments.push(`N4*${normalizeText(context.patient.address?.city).slice(0, 30)}*${normalizeText(context.patient.address?.state).slice(0, 2)}*${formatZipCode(context.patient.address?.zipCode)}`);
    segments.push(`DMG*D8*${formatDate(normalizeDate(context.patient.dateOfBirth))}*${mapGenderCode(context.patient.sex || context.patient.gender)}`);
  }

  segments.push(
    `CLM*${options.claimControlNumber.slice(0, 20)}*${claimAmount}***${placeOfService}:B:${frequencyCode}*Y*A*Y*Y`,
    `DTP*434*D8*${formatDate(normalizeDate(context.claim.claimDate) ?? serviceDate)}`,
  );

  if (diagnosisCodes.length) {
    segments.push(`HI*${buildDiagnosisSegments(diagnosisCodes)}`);
  }

  segments.push(
    `NM1*82*1*${renderingProviderName.lastName}*${renderingProviderName.firstName}****XX*${normalizeDigits(context.renderingProvider.npi).slice(0, 10)}`
  );

  if (normalizeText(context.renderingProvider.taxonomyCode)) {
    segments.push(`PRV*PE*PXC*${normalizeText(context.renderingProvider.taxonomyCode).slice(0, 10)}`);
  }

  context.claim.claimLines.forEach((line, index) => {
    const serviceLineDate = normalizeDate(line.serviceDateFrom) ?? serviceDate;
    const procedure = buildServiceLineProcedure(line);
    const diagnosisPointers = buildDiagnosisPointers(line);

    segments.push(`LX*${line.lineNumber ?? index + 1}`);
    segments.push(
      `SV1*${procedure}*${formatAmount(line.chargeAmount)}*UN*${typeof line.units === 'number' ? line.units : 1}***${diagnosisPointers}`
    );
    segments.push(`DTP*472*D8*${formatDate(serviceLineDate)}`);

    if (normalizeText(line.priorAuthorizationNumber)) {
      segments.push(`REF*G1*${normalizeText(line.priorAuthorizationNumber).slice(0, 30)}`);
    }

    if (normalizeText(line.referralNumber)) {
      segments.push(`REF*9F*${normalizeText(line.referralNumber).slice(0, 30)}`);
    }
  });

  const segmentCount = segments.length + 1;
  segments.push(`SE*${segmentCount}*${options.transactionSetControlNumber}`);
  segments.push(`GE*1*${options.groupControlNumber}`);
  segments.push(`IEA*1*${options.interchangeControlNumber.padStart(9, '0')}`);

  return {
    claimControlNumber: options.claimControlNumber.slice(0, 20),
    fileType: '837P',
    payload: `${segments.join('~')}~`,
  };
}
