import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';
import { setupGameSocket } from './sockets/gameSocket.js';
import { startRoomCleanupScheduler } from './utils/roomCleanup.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow local development and same-origin or no origin (mobile/curl)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST']
};

app.use(cors(corsOptions));
app.use(express.json());

// REST API routes
app.use('/api', apiRoutes);

// Socket.IO configuration
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup game sockets
setupGameSocket(io);

// Start room cleanup background job
startRoomCleanupScheduler();

// Global 404 handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

server.listen(PORT, () => {
  console.log(`[Comfort Cards Server] Running on http://localhost:${PORT}`);
});

export { app, server, io };
