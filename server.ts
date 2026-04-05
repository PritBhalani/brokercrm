import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/createApp.ts';
import { connectDb } from './server/dbConnect.ts';
import { initCronJobs } from './server/utils/cronJobs.ts';

async function startServer() {
  try {
    await connectDb();
    console.log('MongoDB connected');
  } catch (err) {
    console.warn(
      '[MongoDB] Startup connection failed. Set MONGODB_URI in .env (e.g. Atlas) or start MongoDB on localhost:27017. API routes will return errors until the database is reachable.'
    );
    console.warn(err instanceof Error ? err.message : err);
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    },
  });

  app.set('socketio', io);

  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });
  });

  initCronJobs();

  const PORT = 3000;

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

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
