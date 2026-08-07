import mongoose from 'mongoose';
import { config } from 'dotenv';
import { claimPredictionService } from './src/modules/rcm/claim-prediction/claim-prediction.service';
import { Claim } from './src/modules/rcm/claim/claim.model';

config();

async function verify() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('Connected to MongoDB');

    // Use the claim ID from the user's example
    const testClaimId = '69ef584d6cb03282b81479aa'; 
    
    console.log(`Triggering prediction for Claim ID: ${testClaimId}...`);
    
    // Note: This might fail if the claim is not in the DB, 
    // but we can at least check if the method exists and compiles.
    const results = await claimPredictionService.predictForClaim(testClaimId);
    
    console.log('Prediction Results:', JSON.stringify(results, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
