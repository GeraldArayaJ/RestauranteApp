const io = require('socket.io-client');

const url = 'http://127.0.0.1:4000';
const socket = io(url, { transports: ['websocket'], reconnectionAttempts: 3 });

console.log('Connecting to', url);
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('ordenEntregada', (orden) => {
  console.log('Received ordenEntregada event:');
  console.log(JSON.stringify(orden, null, 2));
  // exit after receiving one event
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('Connect error', err.message || err);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});
