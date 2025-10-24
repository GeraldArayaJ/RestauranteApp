import { API_URL, getToken, authHeaders, checkAuth } from "./common.js";
checkAuth();
const mesasDiv = document.getElementById('mesas');
let mesas = [];
let seleccionada = null;

// Socket.io para actualizar mesas en tiempo real
const socket = io(API_URL.replace(/\/api\/?$/, ''));
socket.on('connect', () => console.log('Socket conectado (mesas):', socket.id));
socket.on('ordenPagada', (orden) => {
  // Cuando se pague una orden, recargar mesas
  cargarMesas();
});

async function cargarMesas() {
  const res = await fetch(API_URL + "/mesas", { headers: authHeaders(), credentials: 'include' });
  mesas = await res.json();
  renderMesas();
}

function renderMesas() {
  mesasDiv.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'row g-4';
  mesas.filter(mesa => mesa.estado !== 'desactivada').forEach(mesa => {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
    const card = document.createElement('div');
    card.className = `card shadow-sm h-100 text-center border-2 ${mesa.estado === 'ocupado' ? 'border-danger' : 'border-success'}`;
    card.style.cursor = 'pointer';
    card.onclick = () => seleccionarMesa(mesa);
    if (seleccionada && seleccionada.id === mesa.id) card.classList.add('border-primary');
    card.innerHTML = `
      <div class="card-body d-flex flex-column justify-content-center align-items-center">
        <h5 class="card-title mb-2">${mesa.nombre}</h5>
        <span class="badge ${mesa.estado === 'ocupado' ? 'bg-danger' : 'bg-success'}">
          ${mesa.estado === 'ocupado' ? 'Ocupada' : 'Libre'}
        </span>
      </div>
    `;
    col.appendChild(card);
    row.appendChild(col);
  });
  mesasDiv.appendChild(row);

}


async function seleccionarMesa(mesa) {
  // Al seleccionar, marcar como ocupada y navegar al menú
  seleccionada = mesa;
  await fetch(API_URL + `/mesas/${seleccionada.id}/estado`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'ocupado' }),
    credentials: 'include'
  });
  localStorage.setItem('mesaId', seleccionada.id);
  window.location.href = "index-menu.html";
}


cargarMesas();
