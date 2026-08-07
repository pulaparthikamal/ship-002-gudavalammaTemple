import mongoose from 'mongoose';
import { Encounter } from '../modules/rcm/encounter/encounter.model';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp_sur_1';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const encounters = await Encounter.find({ isDeleted: false }).limit(3);
  console.log('Recent Encounters:', JSON.stringify(encounters, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
