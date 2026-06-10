import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export const initWebSocketServer = (server: HttpServer) => {
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[WebSocket] Client connected. Total clients: ${clients.size}`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WebSocket] Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error: ', error);
      clients.delete(ws);
    });

    // Send a welcome message
    ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Warehouse WMS WebSocket Service' }));
  });

  server.on('upgrade', (request, socket, head) => {
    if (wss) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss?.emit('connection', ws, request);
      });
    }
  });

  return wss;
};

export const broadcast = (type: string, data: any) => {
  if (!wss) {
    console.warn('[WebSocket] Cannot broadcast, server not initialized');
    return;
  }

  const payload = JSON.stringify({ type, data, timestamp: new Date() });
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};
