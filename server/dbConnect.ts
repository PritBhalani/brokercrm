import mongoose from 'mongoose';

/** Reuse connection across serverless invocations (Vercel). */
export async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Add it in your host environment (e.g. Render) or in a local .env file.'
    );
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 12_000,
    socketTimeoutMS: 45_000,
    maxPoolSize: 10,
  });
}
