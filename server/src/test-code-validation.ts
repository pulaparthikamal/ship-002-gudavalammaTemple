import mongoose from 'mongoose';
import { chargeService } from './modules/rcm/charge/charge.service';
import { Charge } from './modules/rcm/charge/charge.model';

async function test() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/db_sur2';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Find ANY charge
    let charge = await Charge.findOne({ isDeleted: false });
    if (!charge) {
      console.log('No charge found for testing.');
      return;
    }

    const testUserId = String(charge.createdByUserId || new mongoose.Types.ObjectId());

    console.log(`Testing validation for Charge: ${charge._id}`);

    // Force it to Draft for validation test
    charge.chargeStatus = 'Draft';
    
    // 2. Add an INVALID CPT code to the charge
    charge.chargeLines = [
      {
        lineNumber: 1,
        cptCode: 'INVALID99',
        units: 1,
        chargeAmount: 100,
        icdCodes: ['Z00.00'],
        icdPointers: [1],
      },
    ] as any;
    await charge.save();

    console.log('Attempting to submit charge with INVALID CPT code...');
    try {
      await chargeService.submitForReview(charge._id.toString(), 'en', testUserId);
      console.log('FAILED: Charge submitted with invalid code (should have been blocked).');
    } catch (error: any) {
      console.log(`SUCCESS: Blocked as expected. Error: ${error.message}`);
    }

    // 3. Test with a VALID code (99213)
    console.log('Attempting to submit charge with VALID CPT code (99213)...');
    charge.chargeLines = [
      {
        lineNumber: 1,
        cptCode: '99213',
        units: 1,
        chargeAmount: 150,
        icdCodes: ['Z00.00'],
        icdPointers: [1],
      },
    ] as any;
    await charge.save();

    try {
      const result = await chargeService.submitForReview(charge._id.toString(), 'en', testUserId);
      console.log(`SUCCESS: Charge submitted successfully. Coding Review Scrub Status: ${result.codingReview.scrubStatus}`);
      
      // Check for mismatch
      const mismatch = (result.codingReview.aiSuggestedFixes ?? []).find((f: string) => f.includes('Clinical Mismatch'));
      if (mismatch) {
        console.log(`SUCCESS: Clinical mismatch detected: ${mismatch}`);
      } else {
        console.log('NOTE: No clinical mismatch detected. (Check if AI suggested the same code).');
      }
      
    } catch (error: any) {
      console.log(`FAILED: Charge submission failed for valid code. Error: ${error.message}`);
    }

    console.log('Validation testing completed.');

  } catch (err: any) {
    console.error('Error during testing:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
