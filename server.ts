import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Routes
import userRoutes from './server/routes/userRoutes.ts';
import leadRoutes from './server/routes/leadRoutes.ts';
import notificationRoutes from './server/routes/notificationRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import dailyReportRoutes from './server/routes/dailyReportRoutes.ts';
import { initCronJobs } from './server/utils/cronJobs.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });

  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.set('socketio', io);

  // Database Connection
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/brokercrm';
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }

  // Socket.io connection
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });
  });

  // Initialize background cron jobs
  initCronJobs();

  // API Routes
  app.use('/api/users', userRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/daily-report', dailyReportRoutes);

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
