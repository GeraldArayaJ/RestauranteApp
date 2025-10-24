import { API_URL, getToken, authHeaders, checkAuth } from "./common.js";
function showMesaExitoModal(mensaje = "¡Mesa guardada exitosamente!") {
    let modal = document.getElementById('modalMesaExito');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalMesaExito';
        modal.className = 'modal-exito-pago';
        modal.innerHTML = `
            <div class="modal-exito-content">
                <div class="checkmark-animation">
                    <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0f7fa"/><polyline points="18,34 28,44 46,22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="exito-text" id="mesaExitoMsg"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('mesaExitoMsg').textContent = mensaje;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 1800);
}
checkAuth();
const mesasDiv = document.getElementById('mesas');
const addMesaForm = document.getElementById('addMesaForm');
const nombreMesaInput = document.getElementById('nombreMesa');
let mesas = [];

async function cargarMesas() {
    const res = await fetch(API_URL + "/mesas", { headers: authHeaders(), credentials: 'include' });
    mesas = await res.json();
    renderMesas();
}

function renderMesas() {
    mesasDiv.innerHTML = '';
        // Mesas activas (libre/ocupado)
        mesas.filter(mesa => mesa.estado !== 'desactivada').forEach(mesa => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
        const card = document.createElement('div');
        card.className = `card mesa-card mb-3 ${mesa.estado === 'ocupado' ? 'mesa-ocupada' : 'mesa-libre'}`;
        card.innerHTML = `
            <div class="card-body d-flex flex-column align-items-start">
                <h5 class="card-title fw-bold mb-2">${mesa.nombre}</h5>
                <span class="badge ${mesa.estado === 'ocupado' ? 'bg-danger' : 'bg-success'} mb-3">
                    ${mesa.estado === 'ocupado' ? 'Ocupada' : 'Libre'}
                </span>
                <div class="mt-auto w-100 d-flex gap-2">
                    <button class="btn btn-outline-primary btn-sm flex-fill edit-btn"><i class="bi bi-pencil"></i> Editar</button>
                    <button class="btn btn-outline-danger btn-sm flex-fill delete-btn">
                        <i class="bi bi-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
        card.querySelector('.edit-btn').onclick = () => openEditMesaModal(mesa);
        card.querySelector('.delete-btn').onclick = () => openDeleteMesaModal(mesa);
        col.appendChild(card);
        mesasDiv.appendChild(col);
    });
    
        // Mesas desactivadas
        const desactivadas = mesas.filter(mesa => mesa.estado === 'desactivada');
        if (desactivadas.length > 0) {
            // Crear título de sección
            const sectionTitle = document.createElement('h5');
            sectionTitle.className = 'mt-4 mb-2 text-secondary';
            sectionTitle.textContent = 'Mesas desactivadas';
            mesasDiv.appendChild(sectionTitle);

            // Grid de mesas desactivadas
            const row = document.createElement('div');
            row.className = 'row g-3';
            desactivadas.forEach(mesa => {
                const col = document.createElement('div');
                col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
                const card = document.createElement('div');
                card.className = 'card mesa-card mb-3 border-warning';
                card.innerHTML = `
                    <div class="card-body d-flex flex-column align-items-start">
                        <h5 class="card-title fw-bold mb-2 text-warning">${mesa.nombre}</h5>
                        <span class="badge bg-warning text-dark mb-3">Desactivada</span>
                        <div class="mt-auto w-100 d-flex gap-2">
                            <button class="btn btn-outline-success btn-sm flex-fill activar-btn"><i class="bi bi-unlock"></i> Activar</button>
                        </div>
                    </div>
                `;
                card.querySelector('.activar-btn').onclick = () => activarMesa(mesa);
                col.appendChild(card);
                row.appendChild(col);
            });
            mesasDiv.appendChild(row);
        }
}

addMesaForm.onsubmit = async (e) => {
    e.preventDefault();
    const nombre = nombreMesaInput.value.trim();
    if (!nombre) return;
    try {
        const res = await fetch(API_URL + "/mesas", {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre }),
            credentials: 'include'
        });
        if (!res.ok) {
            const error = await res.text();
            alert('Error al crear mesa: ' + error);
            return;
        }
        nombreMesaInput.value = '';
        showMesaExitoModal("¡Mesa agregada exitosamente!");
        await cargarMesas();
    } catch (err) {
        alert('Error de red o permisos: ' + err.message);
    }
};


// MODAL LOGIC usando Bootstrap
const editMesaModalEl = document.getElementById('editMesaModal');
const editMesaForm = document.getElementById('editMesaForm');
const editMesaId = document.getElementById('editMesaId');
const editMesaNombre = document.getElementById('editMesaNombre');
const editMesaEstado = document.getElementById('editMesaEstado');
let editMesaModal;

const deleteMesaModalEl = document.getElementById('deleteMesaModal');
const deleteMesaText = document.getElementById('deleteMesaText');
const confirmDeleteMesa = document.getElementById('confirmDeleteMesa');
let deleteMesaModal;
let mesaAEliminar = null;

const addMesaModalEl = document.getElementById('addMesaModal');
let addMesaModal;

// Inicializar modales Bootstrap al cargar
document.addEventListener('DOMContentLoaded', () => {
    editMesaModal = new bootstrap.Modal(editMesaModalEl);
    deleteMesaModal = new bootstrap.Modal(deleteMesaModalEl);
    addMesaModal = new bootstrap.Modal(addMesaModalEl);
});

function openEditMesaModal(mesa) {
    editMesaId.value = mesa.id;
    editMesaNombre.value = mesa.nombre;
    editMesaEstado.value = mesa.estado;
    if (!editMesaModal) editMesaModal = new bootstrap.Modal(editMesaModalEl);
    editMesaModal.show();
}

editMesaForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = editMesaId.value;
    const nombre = editMesaNombre.value.trim();
    const estado = editMesaEstado.value;
    if (!nombre) return;
    await fetch(API_URL + `/mesas/${id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, estado }),
        credentials: 'include'
    });
    editMesaModal.hide();
    showMesaExitoModal("¡Mesa editada exitosamente!");
    await cargarMesas();
};

// --- Eliminar/Desactivar Mesa ---
function openDeleteMesaModal(mesa) {
    mesaAEliminar = mesa;
    deleteMesaText.textContent = `¿Seguro que quieres desactivar la mesa "${mesa.nombre}"?`;
    if (!deleteMesaModal) deleteMesaModal = new bootstrap.Modal(deleteMesaModalEl);
    deleteMesaModal.show();
}

confirmDeleteMesa.onclick = async () => {
    if (!mesaAEliminar) return;
    // Cambiar estado a desactivada en vez de eliminar
    const res = await fetch(API_URL + `/mesas/${mesaAEliminar.id}/estado`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'desactivada' }),
        credentials: 'include'
    });
    if (res.ok) {
        deleteMesaModal.hide();
        showMesaExitoModal("¡Mesa desactivada!");
        await cargarMesas();
    } else {
        alert('No se pudo desactivar la mesa.');
    }
};

// Activar mesa (poner en estado libre)
async function activarMesa(mesa) {
    const res = await fetch(API_URL + `/mesas/${mesa.id}/estado`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'libre' }),
        credentials: 'include'
    });
    if (res.ok) {
        showMesaExitoModal("¡Mesa activada!");
        await cargarMesas();
    } else {
        alert('No se pudo activar la mesa.');
    }
}

// --- Agregar Mesa Modal ---
const abrirAddMesa = document.getElementById('abrirAddMesa');
abrirAddMesa.onclick = () => {
    if (!addMesaModal) addMesaModal = new bootstrap.Modal(addMesaModalEl);
    addMesaModal.show();
};

// Botones de cancelar en los modales (usando delegación por si no existen)
document.addEventListener('click', function (e) {
    if (e.target.matches('[data-bs-dismiss="modal"]')) {
        // Bootstrap maneja el cierre automáticamente
    }
});

cargarMesas();
