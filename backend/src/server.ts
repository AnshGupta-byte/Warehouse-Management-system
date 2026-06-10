import http from 'http';
import app from './app';
import { initWebSocketServer } from './services/websocketService';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize WebSocket server
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`[Server] WMS Backend is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[Server] API Documentation available at http://localhost:${PORT}/api/docs`);
});
