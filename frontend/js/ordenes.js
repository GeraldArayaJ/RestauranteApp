import { API_URL, authHeaders, checkAuth, apiFetch } from "./common.js";
checkAuth();

// Conectar socket al servidor (sin /api)
const socket = io(API_URL.replace(/\/api\/?$/, ''));
let ordenesPendientes = [];
let platos = [];
let mesasLibres = [];

const listaOrdenes = document.getElementById("listaOrdenes");

// ==========================
// Cargar platos, órdenes y mesas
// ==========================
async function cargarDatos() {
    try {
    platos = (await apiFetch("/platos", { headers: authHeaders() })).filter(p => p.estado === 'disponible');
        const todas = await apiFetch("/ordenes", { headers: authHeaders() });
        ordenesPendientes = todas.filter(o => o.estado === 'pendiente');

        const todasMesas = await apiFetch("/mesas", { headers: authHeaders() });
        mesasLibres = todasMesas.filter(m => m.estado === 'libre');

        actualizarUI();
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// ==========================
// Actualizar tabla de órdenes
// ==========================
function actualizarUI() {
    listaOrdenes.innerHTML = "";
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const canAccionar = user && (user.rol === 'admin' || user.rol === 'recepcionista');

    ordenesPendientes.forEach(o => {
        const itemsStr = o.items.map(i => {
            const plato = platos.find(p => p.id === i.platoId);
            return `${plato ? plato.nombre : i.platoId} x${i.cantidad} ($${plato ? plato.precio.toFixed(2) : 0})`;
        }).join(", ");

        // Mostrar solo los platos que tienen detalles
        const detallesStr = o.items
            .filter(it => it.detalles && it.detalles.trim())
            .map(it => {
                const plato = platos.find(p => p.id === it.platoId);
                return `<b>${plato ? plato.nombre : it.platoId} (x${it.cantidad}):</b> ${it.detalles}`;
            })
            .join('<br>');

        const mesaNombre = o.mesa ? o.mesa.nombre : (o.mesaId ? `Mesa #${o.mesaId}` : '');
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${o.id}</td>
            <td>${o.usuario.nombre}</td>
            <td class="td-items">${itemsStr}</td>
            <td>${detallesStr}</td>
            <td>$${o.total.toFixed(2)}</td>
            <td>${mesaNombre}</td>
            <td>
                ${canAccionar ? `<button type="button" class="btn btn-success btn-sm me-1 entregar-btn" data-id="${o.id}"><i class="bi bi-check-circle"></i> Entregar</button>` : ''}
                ${canAccionar ? `<button type="button" class="btn btn-outline-primary btn-sm edit-btn" data-id="${o.id}"><i class="bi bi-pencil"></i> Editar</button>` : ''}
            </td>
        `;

        if (canAccionar) {
            tr.querySelector('.edit-btn').onclick = () => editarOrden(o.id);
            tr.querySelector('.entregar-btn').onclick = () => entregarOrden(o.id);
        }

        listaOrdenes.appendChild(tr);
    });
}

// ==========================
// Entregar orden
// ==========================
window.entregarOrden = async (ordenId) => {
    const index = ordenesPendientes.findIndex(o => o.id === ordenId);
    if (index === -1) return;

    const btn = document.querySelector(`#listaOrdenes button[onclick*="entregarOrden(${ordenId})"]`);
    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/ordenes/${ordenId}/entregar`, {
            method: "POST",
            headers: authHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const text = await res.text();
            alert('Error al entregar la orden: ' + (text || res.statusText));
            if (btn) btn.disabled = false;
            return;
        }

    ordenesPendientes.splice(index, 1);
    mostrarAnimacionExito('¡Orden entregada!');
    actualizarUI();
    } catch (err) {
        console.error('Error entregando orden:', err);
        alert('No se pudo entregar la orden. Revisa la conexión.');
        if (btn) btn.disabled = false;
    }
};

// ==========================
// Modal editar orden
// ==========================
const modalEditar = new bootstrap.Modal(document.getElementById('modalEditarOrden'));
const formEditar = document.getElementById('formEditarOrden');
const platosEditarDiv = document.getElementById('platosEditar');
let ordenEditando = null;

window.editarOrden = (ordenId) => {
    ordenEditando = ordenesPendientes.find(o => o.id === ordenId);
    if (!ordenEditando) return;
    renderEditarPlatos();
    renderMesaEditar();
    modalEditar.show();
};

formEditar.onsubmit = async (e) => {
    e.preventDefault();
    try {
        const nuevaMesaId = parseInt(document.getElementById('mesaEditarSelect').value);
        const mesaAnteriorId = ordenEditando.mesaId;

        const res = await fetch(`${API_URL}/ordenes/${ordenEditando.id}`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ items: ordenEditando.items, mesaId: nuevaMesaId })
        });
        if (!res.ok) {
            alert('Error al actualizar la orden');
            return;
        }

        // Cambiar estado de mesas si aplica
        if (mesaAnteriorId && mesaAnteriorId !== nuevaMesaId) {
            await fetch(`${API_URL}/mesas/${mesaAnteriorId}/estado`, {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ estado: 'libre' })
            });
            await fetch(`${API_URL}/mesas/${nuevaMesaId}/estado`, {
                method: 'PUT',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ estado: 'ocupado' })
            });
        }

    cerrarModal();
    mostrarAnimacionExito('¡Orden editada!');
    cargarDatos();
    } catch (err) {
        alert('No se pudo actualizar la orden');
    }
};

function cerrarModal() {
    modalEditar.hide();
    ordenEditando = null;
}

// ==========================
// Render de platos y mesas
// ==========================
function renderEditarPlatos() {
    platosEditarDiv.innerHTML = '';
    if (!ordenEditando) return;

    ordenEditando.items.forEach((item, idx) => {
        const plato = platos.find(p => p.id === item.platoId);
        const div = document.createElement('div');
        div.className = 'plato-edit-row';

        let cantidadEliminar = 1;
        if (item.cantidad > 1) {
            const select = document.createElement('select');
            for (let i = 1; i <= item.cantidad; i++) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `Eliminar ${i}`;
                select.appendChild(opt);
            }
            select.value = 1;
            select.onchange = () => cantidadEliminar = parseInt(select.value);
            div.appendChild(select);
        }

        div.innerHTML += `
            <span>${plato ? plato.nombre : item.platoId} x${item.cantidad}${item.detalles ? ' ('+item.detalles+')' : ''}</span>
            <button type="button" class="del-btn">Eliminar</button>
        `;
        platosEditarDiv.appendChild(div);

        div.querySelector('.del-btn').onclick = () => {
            if (item.cantidad > 1 && cantidadEliminar < item.cantidad) {
                item.cantidad -= cantidadEliminar;
            } else {
                ordenEditando.items.splice(idx, 1);
            }
            renderEditarPlatos();
        };
    });

    // Agregar nuevo plato
    const selectAgregar = document.createElement('select');
    selectAgregar.innerHTML = '<option value="">Agregar plato...</option>' + platos.map(p => `<option value="${p.id}">${p.nombre} ($${p.precio.toFixed(2)})</option>`).join('');
    const inputCantidad = document.createElement('input');
    inputCantidad.type = 'number';
    inputCantidad.min = 1;
    inputCantidad.value = 1;
    inputCantidad.placeholder = 'Cantidad';
    const inputDetalles = document.createElement('input');
    inputDetalles.type = 'text';
    inputDetalles.placeholder = 'Detalles (opcional)';
    const btnAgregar = document.createElement('button');
    btnAgregar.type = 'button';
    btnAgregar.textContent = 'Agregar';
    btnAgregar.className = 'primary';

    btnAgregar.onclick = () => {
        const platoId = parseInt(selectAgregar.value);
        const cantidad = parseInt(inputCantidad.value);
        const detalles = inputDetalles.value.trim();
        if (!platoId || cantidad < 1) return;
        const existente = ordenEditando.items.find(i => i.platoId === platoId && (i.detalles||'') === detalles);
        if (existente) existente.cantidad += cantidad;
        else ordenEditando.items.push({ platoId, cantidad, detalles });
        renderEditarPlatos();
    };

    platosEditarDiv.appendChild(selectAgregar);
    platosEditarDiv.appendChild(inputCantidad);
    platosEditarDiv.appendChild(inputDetalles);
    platosEditarDiv.appendChild(btnAgregar);
}

function renderMesaEditar() {
    const select = document.getElementById('mesaEditarSelect');
    if (!select) return;
    select.innerHTML = '';
    let opciones = [...mesasLibres];

    if (ordenEditando && ordenEditando.mesaId) {
        const yaIncluida = opciones.some(m => m.id === ordenEditando.mesaId);
        if (!yaIncluida) {
            apiFetch('/mesas', { headers: authHeaders() }).then(todasMesas => {
                const mesaActual = todasMesas.find(m => m.id === ordenEditando.mesaId);
                if (mesaActual) opciones.push(mesaActual);
                renderOpcionesMesaEditar(select, opciones);
            });
            return;
        }
    }

    renderOpcionesMesaEditar(select, opciones);
}

function renderOpcionesMesaEditar(select, opciones) {
    opciones.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.nombre + (m.estado === 'ocupado' ? ' (ocupada)' : '');
        if (ordenEditando && ordenEditando.mesaId === m.id) opt.selected = true;
        select.appendChild(opt);
    });
}

// ==========================
// Socket para nuevas órdenes
// ==========================
socket.on("nuevaOrden", (orden) => {
    ordenesPendientes.push(orden);
    actualizarUI();
});

// Animación de éxito
function mostrarAnimacionExito(texto) {
    let modal = document.createElement('div');
    modal.className = 'modal-exito-pago';
    modal.innerHTML = `
        <div class="modal-exito-content">
            <div class="checkmark-animation">
                <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0f7fa"/><polyline points="18,34 28,44 46,22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="exito-text">${texto || '¡Éxito!'}</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
        modal.remove();
    }, 1800);
}

// ==========================
// Nueva Orden
// ==========================
const btnNuevaOrden = document.getElementById('btnNuevaOrden');
const modalCrear = new bootstrap.Modal(document.getElementById('modalCrearOrden'));
const formCrear = document.getElementById('formCrearOrden');
const tipoOrdenSelect = document.getElementById('tipoOrdenSelect');
const mesaCrearDiv = document.getElementById('mesaCrearDiv');
const mesaCrearSelect = document.getElementById('mesaCrearSelect');
const platosCrearDiv = document.getElementById('platosCrear');

btnNuevaOrden.onclick = () => {
    renderPlatosCrear();
    renderMesasCrear();
    tipoOrdenSelect.value = 'normal';
    mesaCrearDiv.style.display = '';
    modalCrear.show();
};

tipoOrdenSelect.onchange = () => {
    if (tipoOrdenSelect.value === 'parallevar') {
        mesaCrearDiv.style.display = 'none';
    } else {
        mesaCrearDiv.style.display = '';
    }
};

function renderMesasCrear() {
    mesaCrearSelect.innerHTML = '';
    mesasLibres.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.nombre;
        mesaCrearSelect.appendChild(opt);
    });
}

// Renderizar platos agrupados por categoría en el modal de crear orden with acordeón
function renderPlatosPorCategoria(platos) {
    const platosCrearDiv = document.getElementById('platosCrear');
    platosCrearDiv.innerHTML = '';
    // Agrupar platos por categoría
    const categorias = {};
    platos.forEach(plato => {
        if (!categorias[plato.categoria]) categorias[plato.categoria] = [];
        categorias[plato.categoria].push(plato);
    });
    Object.keys(categorias).forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'platos-categoria-block';
        // Título de categoría (acordeón)
        const catTitle = document.createElement('h4');
        catTitle.textContent = cat;
        catTitle.className = 'platos-categoria-titulo platos-categoria-toggle';
        catTitle.tabIndex = 0;
        catTitle.setAttribute('role', 'button');
        catTitle.setAttribute('aria-expanded', 'false');
        catDiv.appendChild(catTitle);
        // Contenedor de platos (oculto por defecto)
        const platosList = document.createElement('div');
        platosList.className = 'platos-categoria-list';
        platosList.style.display = 'none';
        categorias[cat].forEach(plato => {
            const row = document.createElement('div');
            row.className = 'plato-edit-row';
            // Checkbox
            const check = document.createElement('input');
            check.type = 'checkbox';
            check.value = plato.id;
            check.className = 'plato-check';
            row.appendChild(check);
            // Nombre y precio
            const label = document.createElement('label');
            label.textContent = `${plato.nombre} ($${plato.precio.toFixed(2)})`;
            label.htmlFor = `plato-${plato.id}`;
            row.appendChild(label);
            // Cantidad
            const cantidad = document.createElement('input');
            cantidad.type = 'number';
            cantidad.min = '1';
            cantidad.value = '1';
            cantidad.className = 'plato-cantidad';
            row.appendChild(cantidad);
            // Detalles
            const detalles = document.createElement('input');
            detalles.type = 'text';
            detalles.placeholder = 'Detalles (opcional)';
            detalles.className = 'plato-detalles';
            row.appendChild(detalles);
            platosList.appendChild(row);
        });
        catDiv.appendChild(platosList);
        // Evento para mostrar/ocultar platos al presionar la categoría
        catTitle.addEventListener('click', () => {
            const expanded = catTitle.getAttribute('aria-expanded') === 'true';
            catTitle.setAttribute('aria-expanded', String(!expanded));
            platosList.style.display = expanded ? 'none' : 'block';
        });
        catTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                catTitle.click();
            }
        });
        platosCrearDiv.appendChild(catDiv);
    });
}

function renderPlatosCrear() {
    // Reemplaza la renderización anterior por la nueva función que agrupa por categoría
    renderPlatosPorCategoria(platos);
}

formCrear.onsubmit = async (e) => {
    e.preventDefault();
    const tipo = tipoOrdenSelect.value;
    let mesaId = null;
    if (tipo === 'normal') {
        mesaId = mesaCrearSelect.value ? parseInt(mesaCrearSelect.value) : null;
        if (!mesaId) return alert('Selecciona una mesa');
    }
    // Obtener platos seleccionados correctamente (acordeón)
    const items = [];
    platosCrearDiv.querySelectorAll('.platos-categoria-list').forEach(catList => {
        catList.querySelectorAll('.plato-edit-row').forEach(row => {
            const check = row.querySelector('.plato-check');
            if (check && check.checked) {
                const cantidad = parseInt(row.querySelector('.plato-cantidad').value);
                const detalles = row.querySelector('.plato-detalles').value.trim();
                if (cantidad > 0) items.push({ platoId: parseInt(check.value), cantidad, detalles });
            }
        });
    });
    if (items.length === 0) return alert('Selecciona al menos un plato');
    try {
        const body = { items };
        if (mesaId) body.mesaId = mesaId;
        const res = await fetch(`${API_URL}/ordenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        if (!res.ok) throw new Error(await res.text());
        mostrarAnimacionExito(tipo === 'parallevar' ? '¡Orden para llevar creada!' : '¡Orden creada!');
        modalCrear.hide();
        cargarDatos();
    } catch (err) {
        alert('Error creando orden: ' + err.message);
    }
};

// ==========================
// Inicializar
// ==========================
cargarDatos();
