import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/createApp.ts';
import { connectDb } from './server/dbConnect.ts';
import { initCronJobs } from './server/utils/cronJobs.ts';
import { getSocketIoCorsOrigin } from './server/config/cors.ts';

function assertProductionJwtSecret() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET?.trim()) {
    console.error('[FATAL] JWT_SECRET is required when NODE_ENV=production');
    process.exit(1);
  }
}

async function startServer() {
  assertProductionJwtSecret();

  try {
    await connectDb();
    console.log('MongoDB connected');
  } catch (err) {
    console.warn(
      '[MongoDB] Startup connection failed. Set MONGODB_URI in .env (e.g. MongoDB Atlas). API routes will return errors until the database is reachable.'
    );
    console.warn(err instanceof Error ? err.message : err);
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: getSocketIoCorsOrigin(),
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  app.set('socketio', io);

  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });
  });

  initCronJobs();

  const PORT = Number(process.env.PORT) || 3000;

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
    const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
    console.log(`HTTP + Socket.io listening on 0.0.0.0:${PORT}`);
    if (publicUrl) console.log(`Public URL: ${publicUrl}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
