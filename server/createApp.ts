import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.ts';
import leadRoutes from './routes/leadRoutes.ts';
import notificationRoutes from './routes/notificationRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import dailyReportRoutes from './routes/dailyReportRoutes.ts';
import { connectDb } from './dbConnect.ts';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.set('socketio', null);

  app.use(async (req, res, next) => {
    try {
      await connectDb();
      next();
    } catch (e) {
      console.error('MongoDB connection error:', e);
      res.status(500).json({ message: 'Database unavailable' });
    }
  });

  app.use('/api/users', userRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/daily-report', dailyReportRoutes);

  return app;
}
