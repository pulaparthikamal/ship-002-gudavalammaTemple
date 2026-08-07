import mongoose from 'mongoose';
import { ProcedureCode } from './src/modules/rcm/procedure-code/procedure-code.model';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rcm_db');
  const codes = await ProcedureCode.find({}).limit(4);
  console.log(JSON.stringify(codes, null, 2));
  process.exit(0);
}

run();
