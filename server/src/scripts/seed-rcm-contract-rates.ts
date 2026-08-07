import 'dotenv/config';
import mongoose from 'mongoose';
import { Patient } from '../modules/rcm/patient/patient.model';
import { InsurancePolicy } from '../modules/rcm/insurance-policy/insurance-policy.model';
import { Payer } from '../modules/rcm/payer/payer.model';
import { Provider } from '../modules/rcm/provider/provider.model';
import { Facility } from '../modules/rcm/facility/facility.model';
import { FeeSchedule } from '../modules/rcm/fee-schedule/fee-schedule.model';
import { CoverageRule } from '../modules/rcm/coverage-rule/coverage-rule.model';
import { EligibilityVerification } from '../modules/rcm/eligibility-verification/eligibility-verification.model';
import { Appointment } from '../modules/rcm/appointment/appointment.model';
import { Encounter } from '../modules/rcm/encounter/encounter.model';
import { Charge } from '../modules/rcm/charge/charge.model';
import { CodingReview } from '../modules/rcm/coding-review/coding-review.model';
import { Claim } from '../modules/rcm/claim/claim.model';
import { ChargeMaster } from '../modules/rcm/charge-master/charge-master.model';
import { ProcedureCode } from '../modules/rcm/procedure-code/procedure-code.model';

const DEMO_SERVICE_DATE = new Date('2026-05-13T14:00:00.000Z');
const DEMO_USER_ID = new mongoose.Types.ObjectId('66500000000000000000f001');
const PASSING_CLAIM_ID = new mongoose.Types.ObjectId('66500000000000000000c101');
const FAILING_CLAIM_ID = new mongoose.Types.ObjectId('66500000000000000000c102');

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp_sur_1';
}

async function upsert(model: any, filter: Record<string, unknown>, payload: Record<string, unknown>) {
  return model.findOneAndUpdate(
    filter,
    {
      $set: {
        ...payload,
        updated: new Date(),
        isDeleted: false,
      },
      $setOnInsert: {
        created: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function coverageSnapshot(params: {
  eligibility: any;
  covered: boolean;
  errors?: string[];
  warnings?: string[];
  matchedRules?: Array<Record<string, unknown>>;
}) {
  return {
    eligibility: {
      eligibilityVerificationId: String(params.eligibility._id),
      eligibilityStatus: params.eligibility.eligibilityStatus,
      coverageStatus: params.eligibility.coverageStatus,
      planActive: params.eligibility.planActive,
      copayAmount: params.eligibility.copayAmount,
      coinsurancePercent: params.eligibility.coinsurancePercent,
      deductibleRemaining: params.eligibility.deductibleRemaining,
      outOfPocketRemaining: params.eligibility.outOfPocketRemaining,
      referralRequired: params.eligibility.referralRequired,
      authorizationRequired: params.eligibility.authorizationRequired,
      checkedAt: params.eligibility.checkedAt,
      vendorName: params.eligibility.vendorName,
    },
    coverageRules: {
      covered: params.covered,
      authorizationRequired: false,
      referralRequired: false,
      errors: params.errors ?? [],
      warnings: params.warnings ?? [],
      matchedRules: params.matchedRules ?? [],
    },
  };
}

export async function seedRcmPhase1Demo() {
  const patient = await upsert(Patient, { medicalRecordNumber: 'RCM-DEMO-001' }, {
    medicalRecordNumber: 'RCM-DEMO-001',
    firstName: 'Jane',
    lastName: 'Demo',
    dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
    gender: 'Female',
    sex: 'Female',
    mobileNumber: '5125550101',
    patientStatus: 'Active',
    address: {
      addressLine1: '100 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'US',
    },
    hipaaConsentSigned: true,
    financialConsentSigned: true,
    active: true,
  });

  const [aetna, bcbs] = await Promise.all([
    upsert(Payer, { payerId: 'AETNA' }, {
      payerId: 'AETNA',
      payerName: 'Aetna Commercial',
      ediPayerId: '60054',
      payerType: 'Commercial',
      claimsSubmissionMethod: 'Electronic',
      eligibilityApiSupported: true,
      activeFlag: true,
      active: true,
    }),
    upsert(Payer, { payerId: 'BCBS' }, {
      payerId: 'BCBS',
      payerName: 'Blue Cross Blue Shield',
      ediPayerId: 'BCBSTX',
      payerType: 'Commercial',
      claimsSubmissionMethod: 'Electronic',
      eligibilityApiSupported: true,
      activeFlag: true,
      active: true,
    }),
  ]);

  const provider = await upsert(Provider, { npi: '1098765432' }, {
    firstName: 'Provider',
    lastName: 'A',
    credentials: 'MD',
    specialty: 'Family Medicine',
    npi: '1098765432',
    taxonomyCode: '207Q00000X',
    providerType: 'Individual',
    phone: '5125550199',
    billingProviderFlag: true,
    renderingProviderFlag: true,
    activeFlag: true,
    active: true,
  });

  const [txFacility, caFacility] = await Promise.all([
    upsert(Facility, { facilityCode: 'RCM-TX-11' }, {
      facilityName: 'RCM Demo Texas Clinic',
      facilityCode: 'RCM-TX-11',
      npi: '1234567890',
      taxId: '11-1223333',
      placeOfServiceCode: '11',
      addressLine1: '200 Clinic Dr',
      city: 'Austin',
      state: 'TX',
      zipCode: '78702',
      phone: '5125550200',
      activeFlag: true,
      active: true,
    }),
    upsert(Facility, { facilityCode: 'RCM-CA-11' }, {
      facilityName: 'RCM Demo California Clinic',
      facilityCode: 'RCM-CA-11',
      npi: '1234567891',
      taxId: '22-2334444',
      placeOfServiceCode: '11',
      addressLine1: '300 Market St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      phone: '4155550200',
      activeFlag: true,
      active: true,
    }),
  ]);

  const [aetnaPolicy, bcbsPolicy] = await Promise.all([
    upsert(InsurancePolicy, { patientId: patient._id, payerId: 'AETNA', memberId: 'AETNA-DEMO-001' }, {
      patientId: patient._id,
      payerId: 'AETNA',
      ediPayerId: aetna.ediPayerId,
      payerType: 'Commercial',
      coverageType: 'PRIMARY',
      planName: 'Aetna PPO Demo',
      memberId: 'AETNA-DEMO-001',
      groupNumber: 'AETNA-GRP-TX',
      coveragePriority: 'Primary',
      coordinationOfBenefitsOrder: 1,
      network: 'IN_NETWORK',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      policyStatus: 'Active',
      relationshipToSubscriber: 'Self',
      insuranceVerifiedFlag: true,
      subscriber: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dateOfBirth,
        gender: patient.gender,
        addressLine1: patient.address?.addressLine1,
        city: patient.address?.city,
        state: patient.address?.state,
        zipCode: patient.address?.zipCode,
      },
      active: true,
    }),
    upsert(InsurancePolicy, { patientId: patient._id, payerId: 'BCBS', memberId: 'BCBS-DEMO-001' }, {
      patientId: patient._id,
      payerId: 'BCBS',
      ediPayerId: bcbs.ediPayerId,
      payerType: 'Commercial',
      coverageType: 'PRIMARY',
      planName: 'BCBS PPO Demo',
      memberId: 'BCBS-DEMO-001',
      groupNumber: 'BCBS-GRP-TX',
      coveragePriority: 'Primary',
      coordinationOfBenefitsOrder: 1,
      network: 'IN_NETWORK',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      policyStatus: 'Active',
      relationshipToSubscriber: 'Self',
      insuranceVerifiedFlag: true,
      subscriber: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dateOfBirth,
        gender: patient.gender,
        addressLine1: patient.address?.addressLine1,
        city: patient.address?.city,
        state: patient.address?.state,
        zipCode: patient.address?.zipCode,
      },
      active: true,
    }),
  ]);

  await Promise.all([
    upsert(ChargeMaster, { cptCode: '99213', placeOfService: '11' }, {
      cptCode: '99213',
      description: 'Office or other outpatient visit, established patient',
      defaultChargeAmount: 160,
      defaultAllowedAmount: 110,
      placeOfService: '11',
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      activeFlag: true,
      active: true,
    }),
    upsert(ProcedureCode, { code: '99213' }, {
      code: '99213',
      description: 'Office/outpatient established patient visit',
      chargeFee: 160,
      category: 'Evaluation and Management',
      requiresAuth: false,
      frequencyLimit: 'Per visit',
      active: true,
    }),
  ]);

  const [aetnaTxRate, bcbsTxRate, aetnaCaRate] = await Promise.all([
    upsert(FeeSchedule, {
      payerId: 'AETNA',
      cptCode: '99213',
      providerId: provider._id,
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'Aetna PPO Demo',
      groupNumber: 'AETNA-GRP-TX',
      network: 'IN_NETWORK',
    }, {
      payerId: 'AETNA',
      cptCode: '99213',
      providerId: provider._id,
      facilityId: txFacility._id,
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'Aetna PPO Demo',
      groupNumber: 'AETNA-GRP-TX',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      allowedAmount: 110,
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      active: true,
    }),
    upsert(FeeSchedule, {
      payerId: 'BCBS',
      cptCode: '99213',
      providerId: provider._id,
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'BCBS PPO Demo',
      groupNumber: 'BCBS-GRP-TX',
      network: 'IN_NETWORK',
    }, {
      payerId: 'BCBS',
      cptCode: '99213',
      providerId: provider._id,
      facilityId: txFacility._id,
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'BCBS PPO Demo',
      groupNumber: 'BCBS-GRP-TX',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      allowedAmount: 95,
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      active: true,
    }),
    upsert(FeeSchedule, {
      payerId: 'AETNA',
      cptCode: '99213',
      providerId: provider._id,
      state: 'CA',
      placeOfServiceCode: '11',
      planName: 'Aetna PPO Demo',
      groupNumber: 'AETNA-GRP-TX',
      network: 'IN_NETWORK',
    }, {
      payerId: 'AETNA',
      cptCode: '99213',
      providerId: provider._id,
      facilityId: caFacility._id,
      state: 'CA',
      placeOfServiceCode: '11',
      planName: 'Aetna PPO Demo',
      groupNumber: 'AETNA-GRP-TX',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      allowedAmount: 130,
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      active: true,
    }),
  ]);

  const [aetnaCoveredRule, bcbsNotCoveredRule] = await Promise.all([
    upsert(CoverageRule, {
      payerId: 'AETNA',
      cptCode: '99213',
      state: 'TX',
      placeOfServiceCode: '11',
      ruleType: 'COVERED',
    }, {
      payerId: 'AETNA',
      planName: 'Aetna PPO Demo',
      groupNumber: 'AETNA-GRP-TX',
      state: 'TX',
      facilityId: txFacility._id,
      providerId: provider._id,
      cptCode: '99213',
      placeOfServiceCode: '11',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      ruleType: 'COVERED',
      ruleValue: { covered: true },
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 100,
      activeFlag: true,
      active: true,
    }),
    upsert(CoverageRule, {
      payerId: 'BCBS',
      cptCode: '99213',
      state: 'TX',
      placeOfServiceCode: '11',
      ruleType: 'NOT_COVERED',
    }, {
      payerId: 'BCBS',
      planName: 'BCBS PPO Demo',
      groupNumber: 'BCBS-GRP-TX',
      state: 'TX',
      facilityId: txFacility._id,
      providerId: provider._id,
      cptCode: '99213',
      placeOfServiceCode: '11',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      ruleType: 'NOT_COVERED',
      ruleValue: { reason: 'Demo non-covered payer rule' },
      effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
      priority: 100,
      activeFlag: true,
      active: true,
    }),
  ]);

  const [aetnaEligibility, bcbsEligibility] = await Promise.all([
    upsert(EligibilityVerification, { insuranceId: aetnaPolicy._id, payerId: 'AETNA', serviceDate: DEMO_SERVICE_DATE, procedureCodes: ['99213'] }, {
      patientId: patient._id,
      insuranceId: aetnaPolicy._id,
      payerId: 'AETNA',
      serviceTypeCode: '30',
      serviceDate: DEMO_SERVICE_DATE,
      coveragePriority: 'Primary',
      procedureCodes: ['99213'],
      correlationId: 'RCM-DEMO-AETNA-ELIG',
      externalVerificationId: 'ELIG-AETNA-DEMO-001',
      vendorName: 'Manual Demo Seed',
      eligibilityStatus: 'Eligible',
      coverageStatus: 'Active',
      planActive: true,
      copayAmount: 20,
      coinsurancePercent: 0,
      deductibleRemaining: 0,
      outOfPocketRemaining: 2500,
      referralRequired: false,
      authorizationRequired: false,
      checkedBy: 'Phase 1 Demo Seed',
      checkedAt: new Date(),
      verificationSource: 'Manual Demo Seed',
      rawRequestPayload: { subscriber: { memberId: '[REDACTED]' } },
      rawResponsePayload: { eligibility: 'Active', memberId: '[REDACTED]' },
      active: true,
    }),
    upsert(EligibilityVerification, { insuranceId: bcbsPolicy._id, payerId: 'BCBS', serviceDate: DEMO_SERVICE_DATE, procedureCodes: ['99213'] }, {
      patientId: patient._id,
      insuranceId: bcbsPolicy._id,
      payerId: 'BCBS',
      serviceTypeCode: '30',
      serviceDate: DEMO_SERVICE_DATE,
      coveragePriority: 'Primary',
      procedureCodes: ['99213'],
      correlationId: 'RCM-DEMO-BCBS-ELIG',
      externalVerificationId: 'ELIG-BCBS-DEMO-001',
      vendorName: 'Manual Demo Seed',
      eligibilityStatus: 'Eligible',
      coverageStatus: 'Active',
      planActive: true,
      copayAmount: 25,
      coinsurancePercent: 0,
      deductibleRemaining: 0,
      outOfPocketRemaining: 3000,
      referralRequired: false,
      authorizationRequired: false,
      checkedBy: 'Phase 1 Demo Seed',
      checkedAt: new Date(),
      verificationSource: 'Manual Demo Seed',
      rawRequestPayload: { subscriber: { memberId: '[REDACTED]' } },
      rawResponsePayload: { eligibility: 'Active', memberId: '[REDACTED]' },
      active: true,
    }),
  ]);

  const appointment = await upsert(Appointment, { patientId: patient._id, appointmentStart: DEMO_SERVICE_DATE, reason: 'RCM Phase 1 demo visit' }, {
    patientId: patient._id,
    providerId: provider._id,
    facilityId: txFacility._id,
    appointmentDate: DEMO_SERVICE_DATE,
    appointmentTime: '14:00',
    appointmentStart: DEMO_SERVICE_DATE,
    appointmentType: 'Follow-Up',
    visitType: 'Office Visit',
    reason: 'RCM Phase 1 demo visit',
    appointmentStatus: 'Completed',
    checkInStatus: 'Checked Out',
    checkInTime: new Date('2026-05-13T13:45:00.000Z'),
    checkOutTime: new Date('2026-05-13T14:30:00.000Z'),
    active: true,
  });

  const encounter = await upsert(Encounter, { appointmentId: appointment._id }, {
    appointmentId: appointment._id,
    patientId: patient._id,
    providerId: provider._id,
    renderingProviderId: provider._id,
    facilityId: txFacility._id,
    encounterDate: DEMO_SERVICE_DATE,
    startTime: DEMO_SERVICE_DATE,
    endTime: new Date('2026-05-13T14:30:00.000Z'),
    visitStatus: 'Completed',
    chiefComplaint: 'Hypertension follow up',
    diagnosisCodes: ['I10'],
    procedureCodes: ['99213'],
    procedureCodeUnits: { '99213': 1 },
    active: true,
  });

  const aetnaCharge = await upsert(Charge, { encounterId: encounter._id, patientId: patient._id, providerId: provider._id, placeOfService: '11' }, {
    encounterId: encounter._id,
    patientId: patient._id,
    providerId: provider._id,
    facilityId: txFacility._id,
    serviceDate: DEMO_SERVICE_DATE,
    placeOfService: '11',
    totalChargeAmount: 160,
    chargeStatus: 'Approved',
    codingReviewStatus: 'Approved for Claim',
    documentationComplete: true,
    reviewedBy: 'Phase 1 Demo Seed',
    chargeLines: [
      {
        lineNumber: 1,
        cptCode: '99213',
        icdCodes: ['I10'],
        icdPointers: [1],
        modifiers: [],
        units: 1,
        chargeAmount: 160,
        diagnosisLinking: 'I10 -> 99213',
        renderingProviderId: provider._id,
        expectedAllowedAmount: 110,
        feeScheduleId: aetnaTxRate._id,
        pricingStatus: 'PRICED',
        pricingMessage: 'Matched AETNA TX POS 11 contract rate.',
      },
    ],
    active: true,
  });

  await upsert(CodingReview, { chargeId: aetnaCharge._id }, {
    chargeId: aetnaCharge._id,
    encounterId: encounter._id,
    patientId: patient._id,
    scrubStatus: 'Passed',
    codingRiskLevel: 'Low',
    missingDocumentationFlag: false,
    icdCptMismatchFlag: false,
    ncciEditFlag: false,
    lcdNcdEditFlag: false,
    reviewedBy: 'Phase 1 Demo Seed',
    reviewedAt: new Date(),
    validationErrors: [],
    active: true,
  });

  const aetnaLine = aetnaCharge.chargeLines[0];
  const passingClaim = await upsert(Claim, { _id: PASSING_CLAIM_ID }, {
    chargeId: aetnaCharge._id,
    encounterId: encounter._id,
    patientId: patient._id,
    payerId: 'AETNA',
    billingProviderId: provider._id,
    renderingProviderId: provider._id,
    facilityId: txFacility._id,
    claimDate: DEMO_SERVICE_DATE,
    totalChargeAmount: 160,
    coveragePriority: 'Primary',
    frequencyCode: '1',
    claimType: 'Professional',
    claimStatus: 'Ready for Submission',
    scrubStatus: 'Passed',
    submissionStatus: 'Not Submitted',
    diagnosisCodes: ['I10'],
    claimLines: [
      {
        lineNumber: 1,
        chargeLineId: aetnaLine?._id,
        cptCode: '99213',
        modifiers: [],
        icdPointers: [1],
        units: 1,
        chargeAmount: 160,
        renderingProviderId: provider._id,
        placeOfService: '11',
        serviceDateFrom: DEMO_SERVICE_DATE,
        serviceDateTo: DEMO_SERVICE_DATE,
        expectedAllowedAmount: 110,
        expectedInsurancePayment: 90,
        expectedPatientResponsibility: 20,
        patientCopayAmount: 20,
        patientCoinsuranceAmount: 0,
        deductibleAppliedAmount: 0,
        feeScheduleId: aetnaTxRate._id,
        pricingMatchedBy: 'payer-provider-facility-cpt-state-pos-plan-group-network',
        pricingSource: 'CONTRACT_RATE',
        pricingSnapshotDate: new Date(),
        eligibilityVerificationId: aetnaEligibility._id,
        authorizationRequired: false,
        referralRequired: false,
        networkStatus: 'IN_NETWORK',
        coverageRuleSnapshot: coverageSnapshot({
          eligibility: aetnaEligibility,
          covered: true,
          matchedRules: [{ coverageRuleId: String(aetnaCoveredRule._id), ruleType: 'COVERED' }],
        }),
      },
    ],
    active: true,
    createdBy: DEMO_USER_ID,
    updatedBy: DEMO_USER_ID,
  });

  const failingClaim = await upsert(Claim, { _id: FAILING_CLAIM_ID }, {
    chargeId: aetnaCharge._id,
    encounterId: encounter._id,
    patientId: patient._id,
    payerId: 'BCBS',
    billingProviderId: provider._id,
    renderingProviderId: provider._id,
    facilityId: txFacility._id,
    claimDate: DEMO_SERVICE_DATE,
    totalChargeAmount: 160,
    coveragePriority: 'Primary',
    frequencyCode: '1',
    claimType: 'Professional',
    claimStatus: 'Ready for Submission',
    scrubStatus: 'Passed',
    submissionStatus: 'Not Submitted',
    diagnosisCodes: ['I10'],
    claimLines: [
      {
        lineNumber: 1,
        chargeLineId: aetnaLine?._id,
        cptCode: '99213',
        modifiers: [],
        icdPointers: [1],
        units: 1,
        chargeAmount: 160,
        renderingProviderId: provider._id,
        placeOfService: '11',
        serviceDateFrom: DEMO_SERVICE_DATE,
        serviceDateTo: DEMO_SERVICE_DATE,
        expectedAllowedAmount: 95,
        expectedInsurancePayment: 70,
        expectedPatientResponsibility: 25,
        patientCopayAmount: 25,
        patientCoinsuranceAmount: 0,
        deductibleAppliedAmount: 0,
        feeScheduleId: bcbsTxRate._id,
        pricingMatchedBy: 'payer-provider-facility-cpt-state-pos-plan-group-network',
        pricingSource: 'CONTRACT_RATE',
        pricingSnapshotDate: new Date(),
        eligibilityVerificationId: bcbsEligibility._id,
        authorizationRequired: false,
        referralRequired: false,
        networkStatus: 'IN_NETWORK',
        coverageRuleSnapshot: coverageSnapshot({
          eligibility: bcbsEligibility,
          covered: false,
          errors: ['Service is not covered by matched coverage rule.'],
          matchedRules: [{ coverageRuleId: String(bcbsNotCoveredRule._id), ruleType: 'NOT_COVERED' }],
        }),
      },
    ],
    active: true,
    createdBy: DEMO_USER_ID,
    updatedBy: DEMO_USER_ID,
  });

  return {
    patientId: String(patient._id),
    providerId: String(provider._id),
    texasFacilityId: String(txFacility._id),
    californiaFacilityId: String(caFacility._id),
    rates: {
      aetnaTx99213Pos11: aetnaTxRate.allowedAmount,
      bcbsTx99213Pos11: bcbsTxRate.allowedAmount,
      aetnaCa99213Pos11: aetnaCaRate.allowedAmount,
    },
    passingClaimId: String(passingClaim._id),
    failingClaimId: String(failingClaim._id),
  };
}

async function main() {
  await mongoose.connect(getMongoUri());
  const summary = await seedRcmPhase1Demo();
  console.log('RCM Phase 1 demo seed completed.');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('RCM Phase 1 demo seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
