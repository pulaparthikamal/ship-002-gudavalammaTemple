import mongoose from 'mongoose';
import { ClaimPredictionService } from './modules/rcm/claim-prediction/claim-prediction.service';
import { Appointment } from './modules/rcm/appointment/appointment.model';

async function verify() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/db_sur2';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const service = new ClaimPredictionService();

    // 1. Find an appointment with a reason that matches ChargeMaster
    let appointment = await Appointment.findOne({ reason: /knee/i, isDeleted: false });
    if (!appointment) {
        // Try another keyword from ChargeMaster samples
        appointment = await Appointment.findOne({ isDeleted: false });
    }

    if (!appointment) {
      console.log('Could not find any appointment for testing.');
      return;
    }

    const testAppointmentId = appointment._id.toString();
    console.log(`Testing prediction for Appointment: ${testAppointmentId} (Reason: ${appointment.reason || 'N/A'})`);

    const results = await service.estimateForAppointment(testAppointmentId);

    console.log('PREDICTION RESULTS:');
    if (results.length === 0) {
        console.log('No codes suggested. Check synonym mapping or AI response.');
    }
    results.forEach(p => {
      console.log(`- CPT: ${p.cptCode}`);
      console.log(`  Description: ${p.explanation}`);
      console.log(`  Source: ${p.source}`);
      console.log(`  Sample Size: ${p.sampleSize}`);
      console.log(`  Predicted Allowed: $${p.predictedAllowed}`);
      console.log(`  Confidence: ${p.confidenceScore}`);
    });

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
