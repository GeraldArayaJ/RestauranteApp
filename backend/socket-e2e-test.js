const io = require('socket.io-client');

const API = 'http://127.0.0.1:4000';
const ADMIN = { correo: 'admin@restaurante.com', password: 'admin123' };
const ORDER_ID = process.argv[2] || '1';

async function login() {
  const res = await fetch(`${API}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN)
  });
  if (!res.ok) throw new Error('Login failed: ' + res.status);
  return res.json();
}

async function deliver(token) {
  const res = await fetch(`${API}/api/ordenes/${ORDER_ID}/entregar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const txt = await res.text();
  return { status: res.status, body: txt };
}

(async function main(){
  try {
    console.log('Logging in...');
    const j = await login();
    const token = j.token;
    console.log('Got token length:', token.length);

    console.log('Connecting socket...');
    const socket = io(API, { transports: ['websocket'] });

    socket.on('connect', async () => {
      console.log('Socket connected:', socket.id);
      console.log('Calling deliver for order', ORDER_ID);
      const result = await deliver(token);
      console.log('Deliver response:', result.status, result.body);
    });

    socket.on('ordenEntregada', (orden) => {
      console.log('Received ordenEntregada event:');
      console.log(JSON.stringify(orden, null, 2));
      process.exit(0);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error', err && err.message ? err.message : err);
      process.exit(1);
    });

    // timeout
    setTimeout(() => {
      console.error('Timeout waiting for ordenEntregada');
      process.exit(2);
    }, 10000);

  } catch (err) {
    console.error('E2E test error', err);
    process.exit(1);
  }
})();
