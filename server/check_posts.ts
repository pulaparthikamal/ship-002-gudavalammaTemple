import mongoose from 'mongoose';
import { Post } from './src/modules/posts/post.model';
import { envConfig } from './src/config/env.config';

async function check() {
  await mongoose.connect(envConfig.mongoUri);
  const count = await Post.countDocuments({});
  console.log('Total posts in DB:', count);
  const sample = await Post.findOne({});
  console.log('Sample post:', JSON.stringify(sample, null, 2));
  process.exit(0);
}
check();
