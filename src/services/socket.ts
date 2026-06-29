import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    return url.endsWith('/api') ? url.slice(0, -4) : url;
  }
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

// Initialize the socket.io-client instance
export const socket = io(getSocketUrl(), {
  autoConnect: false,
});

export default socket;
