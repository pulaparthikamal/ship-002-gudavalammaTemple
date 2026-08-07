import mongoose from 'mongoose';
import { CodingReview } from '../modules/rcm/coding-review/coding-review.model';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp_sur_1';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const reviews = await CodingReview.find({ isDeleted: false }).limit(5);
  console.log('Recent Coding Reviews:', JSON.stringify(reviews, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
