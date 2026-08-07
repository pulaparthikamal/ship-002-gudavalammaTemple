import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Payer } from './src/modules/rcm/payer/payer.model';

dotenv.config();

async function addSelfPay() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp_sur_1');
  
  await Payer.findOneAndUpdate(
    { payerName: "Self-Pay" },
    { 
      payerName: "Self-Pay", 
      payerId: "SELF_PAY", 
      active: true, 
      isDeleted: false,
      payerType: "Private"
    },
    { upsert: true }
  );

  console.log('Self-Pay payer added/verified');
  process.exit(0);
}

addSelfPay();
