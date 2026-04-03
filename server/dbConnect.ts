import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brokercrm';

/** Reuse connection across serverless invocations (Vercel). */
export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI);
}
