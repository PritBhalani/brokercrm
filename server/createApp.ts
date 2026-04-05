import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.ts';
import leadRoutes from './routes/leadRoutes.ts';
import notificationRoutes from './routes/notificationRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import dailyReportRoutes from './routes/dailyReportRoutes.ts';
import { connectDb } from './dbConnect.ts';
import { getExpressCorsOptions } from './config/cors.ts';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors(getExpressCorsOptions()));
  app.use(express.json());

  app.set('socketio', null);

  /** No DB — use to verify Vercel routing before fixing Mongo env. */
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'broker-crm' });
  });

  app.use(async (req, res, next) => {
    try {
      await connectDb();
      next();
    } catch (e) {
      console.error('MongoDB connection error:', e);
      const raw = e instanceof Error ? e.message : String(e);
      const hint =
        e instanceof Error && e.message.includes('MONGODB_URI')
          ? e.message
          : 'Database unavailable. Check MONGODB_URI on your host (e.g. Render) and Atlas Network Access (allow 0.0.0.0/0). If the DB password has @ # : / ? use URL-encoded characters in the URI.';
      const debug =
        process.env.DEBUG_API_ERRORS === '1' || process.env.VERCEL_DEBUG === '1';
      res.status(500).json({
        message: hint,
        ...(debug && { detail: raw }),
      });
    }
  });

  app.use('/api/users', userRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/daily-report', dailyReportRoutes);

  return app;
}
