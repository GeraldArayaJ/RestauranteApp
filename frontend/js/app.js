import { API_URL, authHeaders, getToken, checkAuth, verifyAuth } from './common.js';

// Verificación de autenticación mejorada para Chrome
(async function initAuth() {
    try {
        // Primero intentar verificación rápida con localStorage
        checkAuth();
        // Luego verificar con el servidor para asegurar que la cookie funciona
        await verifyAuth();
    } catch (error) {
        console.error('Error de autenticación:', error);
        // Si falla, redirigir al login
        window.location.href = location.origin + "/frontend/login.html";
    }
})();

// --- State
let menuPlatos = []; // list of platos
let ordenActual = [];

// --- Utils
function fmtMoney(n) { return Number(n || 0).toFixed(2); }

// isAdmin debe obtener el rol del backend, no de localStorage
function isAdmin() {
    // Este método debe ser reemplazado por una consulta al backend si se requiere saber el rol
    return false;
}

// --- DOM refs
const menuDiv = document.getElementById('menuPlatos');
const ordenList = document.getElementById('ordenItems');
const ordenTotalEl = document.getElementById('ordenTotal');
const searchInput = document.getElementById('searchInput');

// modal refs
const platoModal = document.getElementById('platoModal');
const platoForm = document.getElementById('platoForm');
const platoIdInput = document.getElementById('platoId');
const nombreInput = document.getElementById('nombrePlato');
const precioInput = document.getElementById('precioPlato');
const categoriaInput = document.getElementById('categoriaPlato');
const cancelPlatoBtn = document.getElementById('cancelPlato');
// detalles modal refs
const detallesModal = document.getElementById('detallesModal');
const detallesForm = document.getElementById('detallesForm');
const detallesPlatoId = document.getElementById('detallesPlatoId');
const detallesText = document.getElementById('detallesText');
const cancelDetallesBtn = document.getElementById('cancelDetalles');

// --- Socket (refresh menu when admin changes)
const socket = io(API_URL.replace(/\/api\/?$/, ''));
socket.on('connect', () => console.log('socket connected', socket.id));
socket.on('menuUpdated', () => loadMenu());

// --- Load menu from server
async function loadMenu() {
    try {
        const res = await fetch(`${API_URL}/platos`, { headers: authHeaders(), credentials: 'include' });
        if (res.status === 401) {
            await promptLogin();
            window.location.reload();
            return;
        }
        if (!res.ok) throw new Error(await res.text());
    menuPlatos = (await res.json()).filter(p => p.estado === 'disponible');
    renderMenu();
    } catch (e) { console.error('loadMenu failed', e); alert('Error cargando menú: ' + e.message); }
}

// Prompt quick login for salonero/admin if no token
async function promptLogin() {
    const correo = prompt('Correo:', 'salonero@restaurante.com');
    const password = prompt('Password:', 'salonero123');
    if (!correo || !password) return null;
    try {
        const r = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password }),
            credentials: 'include' // recibir cookie
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'login failed');
        // Guardar usuario en localStorage para checkAuth()
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
    } catch (e) { alert('Login fallido'); return null; }
}

// --- Render menu grouped by category (accordion)
function renderMenu() {
    const q = (searchInput?.value || '').toLowerCase();
    const grouped = {};
    menuPlatos.filter(p => p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)).forEach(p => {
        (grouped[p.categoria] = grouped[p.categoria] || []).push(p);
    });

    menuDiv.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'row g-4 align-items-start';
    Object.keys(grouped).sort().forEach(cat => {
            const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-4 col-lg-3 d-flex flex-column align-items-stretch p-0';
            // Tarjeta de categoría Bootstrap
            const card = document.createElement('div');
        card.className = 'card h-100 shadow border-primary mb-0';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div class="card-body text-center">
                    <h5 class="card-title text-primary mb-2">${cat}</h5>
                    <span class="badge bg-secondary mb-2">${grouped[cat].length} platos</span>
                    <i class="bi bi-chevron-down"></i>
                </div>
            `;
            // Contenedor para los platos (oculto por defecto)
            const platosContainer = document.createElement('div');
            platosContainer.className = 'platos-collapse';
            platosContainer.style.display = 'none';
            // Renderizar los platos de la categoría en columna vertical Bootstrap
        const platosCol = document.createElement('div');
        platosCol.className = 'd-flex flex-column w-100 gap-2 mt-2';
            grouped[cat].forEach(p => {
                const platoCard = document.createElement('div');
                platoCard.className = 'card h-100 shadow-sm border-info';
                platoCard.innerHTML = `
                    <div class="card-body d-flex flex-column align-items-center justify-content-center">
                        <h6 class="card-title mb-2">${p.nombre}</h6>
                        <span class="badge bg-info text-dark mb-2">$${fmtMoney(p.precio)}</span>
                        <button class="btn btn-outline-primary btn-sm w-100">Agregar</button>
                    </div>
                `;
                platoCard.querySelector('button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    detallesPlatoId.value = p.id;
                    detallesText.value = '';
                    // Mostrar modal usando Bootstrap si está disponible
                    if (window.bootstrap && typeof bootstrap.Modal === 'function') {
                        const modal = bootstrap.Modal.getOrCreateInstance(detallesModal);
                        modal.show();
                    } else {
                        detallesModal.style.display = 'block';
                        detallesModal.setAttribute('aria-hidden', 'false');
                    }
                    setTimeout(() => detallesText.focus(), 150);
                });
                platosCol.appendChild(platoCard);
            });
            platosContainer.appendChild(platosCol);
            // Evento para mostrar/ocultar los platos al hacer clic en la categoría
            card.addEventListener('click', () => {
                platosContainer.style.display = platosContainer.style.display === 'none' ? 'block' : 'none';
            });
            col.appendChild(card);
            col.appendChild(platosContainer);
            grid.appendChild(col);
    });
    menuDiv.appendChild(grid);
}

// --- Order actions
function onAddPlato(plato) {
    // open detalles modal and store plato id to be added after submit
    detallesPlatoId.value = plato.id;
    detallesText.value = '';
    detallesModal.setAttribute('aria-hidden', 'false');
    // focus textarea for convenience
    setTimeout(() => detallesText.focus(), 150);
}

function renderOrder() {
    ordenList.innerHTML = '';
    let total = 0;
    ordenActual.forEach((it, idx) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex flex-wrap align-items-center justify-content-between py-3 px-3 border rounded shadow-sm mb-2';
        li.innerHTML = `
            <div class="d-flex flex-column flex-md-row align-items-md-center gap-2">
                <strong class="fs-5 text-primary">${it.nombre}</strong>
                ${it.detalles ? `<small class="text-muted ms-md-2">${it.detalles}</small>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary" title="Restar" data-minus><i class="bi bi-dash"></i></button>
                <span class="badge bg-info text-dark fs-6">${it.cantidad}</span>
                <button class="btn btn-sm btn-outline-secondary" title="Sumar" data-plus><i class="bi bi-plus"></i></button>
                <span class="fw-bold text-success fs-5 ms-2">$${fmtMoney(it.precio * it.cantidad)}</span>
                <button class="btn btn-sm btn-outline-danger ms-2" title="Quitar" data-remove><i class="bi bi-x-lg"></i></button>
            </div>
        `;
        // Botón restar cantidad
        li.querySelector('[data-minus]').addEventListener('click', () => {
            if (it.cantidad > 1) {
                it.cantidad--;
            } else {
                ordenActual.splice(idx, 1);
            }
            renderOrder();
        });
        // Botón sumar cantidad
        li.querySelector('[data-plus]').addEventListener('click', () => {
            it.cantidad++;
            renderOrder();
        });
        // Botón quitar (elimina todo el ítem)
        li.querySelector('[data-remove]').addEventListener('click', () => {
            ordenActual.splice(idx, 1);
            renderOrder();
        });
        ordenList.appendChild(li);
        total += it.precio * it.cantidad;
    });
        ordenTotalEl.className = 'fw-bold fs-4 text-success';
        ordenTotalEl.textContent = fmtMoney(total);
}

document.getElementById('clearOrden').addEventListener('click', () => {
    ordenActual = [];
    renderOrder();
    showOrdenExitoModal('¡Orden limpiada!');
});

document.getElementById('enviarOrden').addEventListener('click', async () => {
    if (ordenActual.length === 0) return showOrdenExitoModal('Agrega al menos un plato');
    try {
        const items = ordenActual.map(i => ({ platoId: i.platoId, cantidad: i.cantidad, detalles: i.detalles || '' }));
        const mesaId = localStorage.getItem('mesaId');
        const body = { items };
        if (mesaId) body.mesaId = parseInt(mesaId);
        const res = await fetch(`${API_URL}/ordenes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
        if (res.status === 401) {
            await promptLogin();
            window.location.reload();
            return;
        }
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        showOrdenExitoModal(`¡Orden #${data.id} enviada!`);
        ordenActual = [];
        renderOrder();
    } catch (e) { console.error(e); showOrdenExitoModal('Error creando orden: ' + e.message); }
});

// --- Admin: create / edit / delete platos
function openPlatoModal(plato) {
    platoModal.setAttribute('aria-hidden', 'false');
    platoIdInput.value = plato?.id || '';
    nombreInput.value = plato?.nombre || '';
    precioInput.value = plato?.precio || '';
    categoriaInput.value = plato?.categoria || '';
    document.getElementById('platoModalTitle').textContent = plato ? 'Editar plato' : 'Nuevo plato';
}

cancelPlatoBtn.addEventListener('click', () => platoModal.setAttribute('aria-hidden', 'true'));

// detalles modal cancel
cancelDetallesBtn.addEventListener('click', () => detallesModal.setAttribute('aria-hidden', 'true'));

// handle detalles form submit: add the plato to ordenActual
detallesForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = detallesPlatoId.value;
    const detalles = detallesText.value.trim();
    // find the plato in menuPlatos
    const plato = menuPlatos.find(p => String(p.id) === String(id));
    if (!plato) { alert('Plato no encontrado'); cerrarModalDetalles(); return; }
    const idx = ordenActual.findIndex(i => i.platoId === plato.id && (i.detalles || '') === (detalles || ''));
    if (idx >= 0) ordenActual[idx].cantidad++;
    else ordenActual.push({ platoId: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1, detalles: detalles || '' });
    cerrarModalDetalles();
    renderOrder();
});

function cerrarModalDetalles() {
    if (window.bootstrap && typeof bootstrap.Modal === 'function') {
        const modal = bootstrap.Modal.getOrCreateInstance(detallesModal);
        modal.hide();
    } else {
        detallesModal.style.display = 'none';
        detallesModal.setAttribute('aria-hidden', 'true');
    }
}

platoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const id = platoIdInput.value;
        const body = { nombre: nombreInput.value.trim(), precio: Number(precioInput.value), categoria: categoriaInput.value.trim() };
        const token = getToken() || await promptLogin();
        if (!token) return;
        let res;
        if (id) res = await fetch(`${API_URL}/platos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
        else res = await fetch(`${API_URL}/platos`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        platoModal.setAttribute('aria-hidden', 'true');
        await loadMenu();
    } catch (err) { console.error(err); alert('Error guardando plato: ' + err.message); }
});

async function onDeletePlato(p) {
    if (!confirm('Eliminar plato?')) return;
    try {
        const res = await fetch(`${API_URL}/platos/${p.id}`, { method: 'DELETE', headers: authHeaders(), credentials: 'include' });
        if (res.status === 401) {
            await promptLogin();
            window.location.reload();
            return;
        }
        if (!res.ok) throw new Error(await res.text());
        await loadMenu();
    } catch (e) { console.error(e); alert('Error eliminando plato: ' + e.message); }
}



searchInput.addEventListener('input', () => renderMenu());

// --- Animación de éxito reutilizable ---
function showOrdenExitoModal(mensaje = "¡Orden enviada exitosamente!") {
    let modal = document.getElementById('modalOrdenExito');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalOrdenExito';
        modal.className = 'modal-exito-pago';
        modal.innerHTML = `
            <div class="modal-exito-content">
                <div class="checkmark-animation">
                    <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0f7fa"/><polyline points="18,34 28,44 46,22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="exito-text" id="ordenExitoMsg"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('ordenExitoMsg').textContent = mensaje;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 1800);
}

// initial
loadMenu();