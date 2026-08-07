import 'dotenv/config';
import mongoose from 'mongoose';
import { ChargeMaster } from '../modules/rcm/charge-master/charge-master.model';
import { FeeSchedule } from '../modules/rcm/fee-schedule/fee-schedule.model';
import { CoverageRule } from '../modules/rcm/coverage-rule/coverage-rule.model';
import { Payer } from '../modules/rcm/payer/payer.model';
import { Provider } from '../modules/rcm/provider/provider.model';
import { Facility } from '../modules/rcm/facility/facility.model';
import { ProcedureCode } from '../modules/rcm/procedure-code/procedure-code.model';

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

export async function seedRcmDentalDemo() {
  await Promise.all([
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
    credentials: 'DDS',
    specialty: 'General Dentistry',
    npi: '1098765432',
    taxonomyCode: '1223G0001X',
    providerType: 'Individual',
    billingProviderFlag: true,
    renderingProviderFlag: true,
    activeFlag: true,
    active: true,
  });

  const facility = await upsert(Facility, { facilityCode: 'RCM-DENTAL-TX-11' }, {
    facilityName: 'RCM Demo Dental Clinic',
    facilityCode: 'RCM-DENTAL-TX-11',
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
  });

  const dentalCodes = [
    { code: 'D1110', description: 'Adult prophylaxis', charge: 125, aetnaAllowed: 82, bcbsAllowed: 78 },
    { code: 'D0120', description: 'Periodic oral evaluation', charge: 75, aetnaAllowed: 48, bcbsAllowed: 42 },
  ];

  for (const item of dentalCodes) {
    await Promise.all([
      upsert(ChargeMaster, { cptCode: item.code, placeOfService: '11' }, {
        cptCode: item.code,
        description: item.description,
        defaultChargeAmount: item.charge,
        defaultAllowedAmount: item.aetnaAllowed,
        placeOfService: '11',
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        activeFlag: true,
        active: true,
      }),
      upsert(ProcedureCode, { code: item.code }, {
        code: item.code,
        description: item.description,
        chargeFee: item.charge,
        category: 'Dental',
        requiresAuth: false,
        frequencyLimit: item.code === 'D1110' ? '2 per year' : '2 per year',
        active: true,
      }),
      upsert(FeeSchedule, {
        payerId: 'AETNA',
        cptCode: item.code,
        providerId: provider._id,
        facilityId: facility._id,
        state: 'TX',
        placeOfServiceCode: '11',
      }, {
        payerId: 'AETNA',
        cptCode: item.code,
        providerId: provider._id,
        facilityId: facility._id,
        state: 'TX',
        placeOfServiceCode: '11',
        network: 'IN_NETWORK',
        coverageType: 'PRIMARY',
        allowedAmount: item.aetnaAllowed,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        active: true,
      }),
      upsert(FeeSchedule, {
        payerId: 'BCBS',
        cptCode: item.code,
        providerId: provider._id,
        facilityId: facility._id,
        state: 'TX',
        placeOfServiceCode: '11',
      }, {
        payerId: 'BCBS',
        cptCode: item.code,
        providerId: provider._id,
        facilityId: facility._id,
        state: 'TX',
        placeOfServiceCode: '11',
        network: 'IN_NETWORK',
        coverageType: 'PRIMARY',
        allowedAmount: item.bcbsAllowed,
        effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
        active: true,
      }),
      upsert(CoverageRule, {
        payerId: 'AETNA',
        cptCode: item.code,
        state: 'TX',
        placeOfServiceCode: '11',
        ruleType: 'COVERED',
      }, {
        payerId: 'AETNA',
        cptCode: item.code,
        state: 'TX',
        facilityId: facility._id,
        providerId: provider._id,
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
    ]);
  }

  return {
    providerId: String(provider._id),
    facilityId: String(facility._id),
    codes: dentalCodes.map((item) => item.code),
  };
}

async function main() {
  await mongoose.connect(getMongoUri());
  const summary = await seedRcmDentalDemo();
  console.log('RCM dental demo seed completed.');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('RCM dental demo seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
