import mongoose from 'mongoose';

/** Reuse connection across serverless invocations (Vercel). */
export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const uri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/brokercrm';
  await mongoose.connect(uri);
}
