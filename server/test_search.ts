import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProcedureCode } from './src/modules/rcm/procedure-code/procedure-code.model';

dotenv.config();

async function testSearch() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp_sur_1');
  
  const keywords = ['teeth', 'pain', 'oral', 'evaluation'];
  const fallbackCodes = await ProcedureCode.find({
    $or: keywords.map(k => ({ 
      $or: [
        { description: { $regex: new RegExp(k, 'i') } },
        { category: { $regex: new RegExp(k, 'i') } }
      ]
    })),
    isDeleted: false,
    active: true,
  }).limit(3);

  console.log('Search Result:', JSON.stringify(fallbackCodes, null, 2));
  process.exit(0);
}

testSearch();
