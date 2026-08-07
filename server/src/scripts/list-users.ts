import mongoose from 'mongoose';
import { User } from '../modules/user/user.model';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/myapp_sur_1';

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const admin = await User.findOne({ email: 'admin@yopmail.com' });
  if (admin) {
    admin.password = 'Admin@123';
    await admin.save();
    console.log('Admin password updated successfully');
  } else {
    console.log('Admin user not found');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
