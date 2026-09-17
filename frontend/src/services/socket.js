import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socketInstance = null;

/**
 * Gets or initializes the Socket.IO client instance.
 * @returns {import('socket.io-client').Socket}
 */
export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });
  }
  return socketInstance;
}

/**
 * Disconnects socket.
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
