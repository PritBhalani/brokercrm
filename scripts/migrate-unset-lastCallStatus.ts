/**
 * One-time migration: remove legacy `lastCallStatus` from all lead documents.
 *
 * Usage (from project root):
 *   npx tsx scripts/migrate-unset-lastCallStatus.ts
 *
 * Requires MONGODB_URI in .env (same as the app), or defaults to mongodb://localhost:27017/brokercrm
 *
 * Dry run (count only, no writes):
 *   DRY_RUN=1 npx tsx scripts/migrate-unset-lastCallStatus.ts
 *   PowerShell: $env:DRY_RUN='1'; npx tsx scripts/migrate-unset-lastCallStatus.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const COLLECTION = 'leads';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/brokercrm';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  await mongoose.connect(uri);
  const col = mongoose.connection.collection(COLLECTION);

  const filter = { lastCallStatus: { $exists: true } };
  const withField = await col.countDocuments(filter);

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`Collection: ${COLLECTION}`);
  console.log(`Documents with lastCallStatus: ${withField}`);

  if (dryRun) {
    console.log('DRY_RUN — no changes applied.');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  if (withField === 0) {
    console.log('Nothing to migrate.');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  const result = await col.updateMany(filter, { $unset: { lastCallStatus: '' } });

  console.log(`Updated: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
