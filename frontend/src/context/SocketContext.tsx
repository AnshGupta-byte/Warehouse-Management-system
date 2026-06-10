import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface MessagePayload {
  type: string;
  data: any;
  timestamp: string;
}

type SocketListener = (payload: MessagePayload) => void;

interface SocketContextType {
  socket: WebSocket | null;
  connected: boolean;
  subscribe: (type: string, listener: SocketListener) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [listeners] = useState<Map<string, Set<SocketListener>>>(new Map());

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      setConnected(false);
      return;
    }

    // Connect to WebSocket server on backend (port 5000)
    const ws = new WebSocket('ws://localhost:5000');

    ws.onopen = () => {
      console.log('[WebSocket] Connection established');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload: MessagePayload = JSON.parse(event.data);
        console.log(`[WebSocket] Message received: ${payload.type}`, payload.data);
        
        // Dispatch to registered type-specific listeners
        const typeListeners = listeners.get(payload.type);
        if (typeListeners) {
          typeListeners.forEach((listener) => listener(payload));
        }

        // Also dispatch to wildcard listeners
        const wildcardListeners = listeners.get('*');
        if (wildcardListeners) {
          wildcardListeners.forEach((listener) => listener(payload));
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Connection closed');
      setConnected(false);
      // Attempt reconnection after 3 seconds
      setTimeout(() => {
        if (localStorage.getItem('wms_token')) {
          console.log('[WebSocket] Attempting reconnection...');
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error occurred:', error);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [user]);

  const subscribe = (type: string, listener: SocketListener) => {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type)!.add(listener);

    // Return unsubscribe callback
    return () => {
      const typeListeners = listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(listener);
        if (typeListeners.size === 0) {
          listeners.delete(type);
        }
      }
    };
  };

  return (
    <SocketContext.Provider value={{ socket, connected, subscribe }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
