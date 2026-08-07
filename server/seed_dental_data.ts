import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Appointment } from './src/modules/rcm/appointment/appointment.model';
import { ProcedureCode } from './src/modules/rcm/procedure-code/procedure-code.model';
import { Patient } from './src/modules/rcm/patient/patient.model';
import { Provider } from './src/modules/rcm/provider/provider.model';
import { Facility } from './src/modules/rcm/facility/facility.model';
import { InsurancePolicy } from './src/modules/rcm/insurance-policy/insurance-policy.model';

dotenv.config();

const procedureCodesData = [
  { "code": "D0120", "category": "Diagnostic", "chargeFee": 500, "description": "Periodic oral evaluation - established patient", "frequencyLimit": "1 per 6 months", "requiresAuth": false },
  { "code": "D0150", "category": "Diagnostic", "chargeFee": 800, "description": "Comprehensive oral evaluation", "frequencyLimit": "1 per 3 years", "requiresAuth": false },
  { "code": "D0180", "category": "Periodontics", "chargeFee": 900, "description": "Comprehensive periodontal evaluation", "frequencyLimit": "1 per year", "requiresAuth": false },
  { "code": "D0274", "category": "Diagnostic", "chargeFee": 1200, "description": "Bitewing X-rays - four images", "frequencyLimit": "1 per year", "requiresAuth": false },
  { "code": "D0330", "category": "Diagnostic", "chargeFee": 2500, "description": "Panoramic X-ray", "frequencyLimit": "1 per 3-5 years", "requiresAuth": false },
  { "code": "D1110", "category": "Preventive", "chargeFee": 1500, "description": "Adult prophylaxis (cleaning)", "frequencyLimit": "1 per 6 months", "requiresAuth": false },
  { "code": "D1206", "category": "Preventive", "chargeFee": 700, "description": "Topical fluoride varnish", "frequencyLimit": "2 per year", "requiresAuth": false },
  { "code": "D1351", "category": "Preventive", "chargeFee": 1000, "description": "Sealant - per tooth", "frequencyLimit": "1 per tooth per 3 years", "requiresAuth": false },
  { "code": "D2140", "category": "Restorative", "chargeFee": 1800, "description": "Amalgam filling - one surface", "frequencyLimit": "1 per tooth per year", "requiresAuth": false },
  { "code": "D2391", "category": "Restorative", "chargeFee": 2500, "description": "Composite filling - one surface", "frequencyLimit": "1 per tooth per year", "requiresAuth": false },
  { "code": "D2392", "category": "Restorative", "chargeFee": 3200, "description": "Composite filling - two surfaces", "frequencyLimit": "1 per tooth per year", "requiresAuth": false },
  { "code": "D2740", "category": "Prosthodontics", "chargeFee": 12000, "description": "Crown - porcelain/ceramic", "frequencyLimit": "1 per tooth per 5 years", "requiresAuth": true },
  { "code": "D2950", "category": "Restorative", "chargeFee": 3500, "description": "Core buildup", "frequencyLimit": "As needed", "requiresAuth": true },
  { "code": "D4341", "category": "Periodontics", "chargeFee": 6000, "description": "Scaling and root planing - 4+ teeth", "frequencyLimit": "1 per quadrant per 2 years", "requiresAuth": true },
  { "code": "D4342", "category": "Periodontics", "chargeFee": 4000, "description": "Scaling and root planing - 1-3 teeth", "frequencyLimit": "1 per quadrant per 2 years", "requiresAuth": true },
  { "code": "D4910", "category": "Periodontics", "chargeFee": 2000, "description": "Periodontal maintenance", "frequencyLimit": "1 per 3-4 months", "requiresAuth": false },
  { "code": "D7140", "category": "Oral Surgery", "chargeFee": 3000, "description": "Simple extraction", "frequencyLimit": "As needed", "requiresAuth": false },
  { "code": "D7210", "category": "Oral Surgery", "chargeFee": 6000, "description": "Surgical extraction", "frequencyLimit": "As needed", "requiresAuth": true },
  { "code": "D3330", "category": "Endodontics", "chargeFee": 14000, "description": "Root canal - molar", "frequencyLimit": "1 per tooth lifetime", "requiresAuth": true }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp_sur_1');
    console.log('Connected to MongoDB');

    // 1. Seed Facility
    let facility = await Facility.findOne({ name: "Smile Dental Clinic" });
    if (!facility) {
      facility = await Facility.create({
        name: "Smile Dental Clinic",
        facilityID: "FAC001",
        npi: "1234567890",
        email: "clinic@smile.com",
        phone: "555-0101",
        address: { street: "123 Main St", city: "Dental City", state: "DC", zip: "12345" }
      });
    }

    // 2. Seed Provider
    let provider = await Provider.findOne({ firstName: "John", lastName: "Smith" });
    if (!provider) {
      provider = await Provider.create({
        firstName: "John",
        lastName: "Smith",
        providerID: "PRO001",
        npi: "0987654321",
        email: "dr.smith@smile.com",
        specialty: "General Dentistry"
      });
    }

    // 3. Seed Procedure Codes
    for (const code of procedureCodesData) {
      await ProcedureCode.findOneAndUpdate(
        { code: code.code },
        { ...code, active: true, isDeleted: false },
        { upsert: true, new: true }
      );
    }
    console.log('Procedure codes seeded');

    // 4. Seed 10 Patients and Policies
    const patientNames = ["Alice", "Bob", "Charlie", "David", "Eva", "Frank", "Grace", "Hank", "Ivy", "Jack"];
    const payers = ["DELTA DENTAL", "AETNA DENTAL", "CIGNA DENTAL", "METLIFE", "UNITEDHEALTHCARE"];

    const patients = [];
    for (let i = 0; i < 10; i++) {
      let patient = await Patient.findOne({ firstName: patientNames[i] });
      if (!patient) {
        patient = await Patient.create({
          firstName: patientNames[i],
          lastName: "Test",
          patientID: `PAT00${i + 1}`,
          medicalRecordNumber: `MRN00${i + 1}`,
          gender: i % 2 === 0 ? "Female" : "Male",
          dateOfBirth: new Date(1980 + i, 0, 1),
          email: `${patientNames[i].toLowerCase()}@test.com`,
          phone: `555-000${i}`
        });
      }
      patients.push(patient);

      // Policy
      await InsurancePolicy.findOneAndUpdate(
        { patientId: patient._id },
        {
          patientId: patient._id,
          payerId: payers[i % payers.length],
          policyNumber: `POL${i}X`,
          groupNumber: "GRP123",
          active: true,
          isDeleted: false,
          coordinationOfBenefitsOrder: 1
        },
        { upsert: true }
      );
    }
    console.log('Patients and Policies seeded');

    // 5. Seed 10 Appointments
    const appointmentScenarios = [
      { reason: "Routine checkup and cleaning", code: "D1110" },
      { reason: "Toothache - need an exam", code: "D0150" },
      { reason: "Bleeding gums - periodontal eval", code: "D0180" },
      { reason: "Need X-rays for my back teeth", code: "D0274" },
      { reason: "Pain in the jaw - panoramic needed", code: "D0330" },
      { reason: "Tooth cleaning and fluoride", code: "D1206" },
      { reason: "Cavity on front tooth - filling", code: "D2391" },
      { reason: "Broken crown - need replacement", code: "D2740" },
      { reason: "Sore tooth - might need root canal", code: "D3330" },
      { reason: "Wisdom tooth extraction", code: "D7210" }
    ];

    for (let i = 0; i < 10; i++) {
      await Appointment.create({
        patientId: patients[i]._id,
        providerId: provider._id,
        facilityId: facility._id,
        appointmentDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        appointmentTime: "10:00",
        appointmentType: i % 3 === 0 ? "New Patient" : "Follow-Up",
        visitType: "Office Visit",
        reason: appointmentScenarios[i].reason,
        appointmentStatus: "Scheduled",
        notes: `Test appointment for ${appointmentScenarios[i].code}`
      });
    }
    console.log('10 Appointments seeded');

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
