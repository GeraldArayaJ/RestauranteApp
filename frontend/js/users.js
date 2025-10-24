import { apiFetch, checkAuth } from './common.js';

const tablaBody = document.getElementById('usuariosBody');
const globalFilter = document.getElementById('globalFilter');
const btnNewUser = document.getElementById('btnNewUser');

// modals
const activarModalEl = document.getElementById('activarModal');
const activarForm = document.getElementById('activarForm');
const activarUserId = document.getElementById('activarUserId');
const activarRol = document.getElementById('activarRol');
let activarModal;
const userModalEl = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const userId = document.getElementById('userId');
const userNombre = document.getElementById('userNombre');
const userCorreo = document.getElementById('userCorreo');
const userPassword = document.getElementById('userPassword');
const userRol = document.getElementById('userRol');
const cancelUser = document.getElementById('cancelUser');
const deleteFromModal = document.getElementById('deleteFromModal');

const deleteModalEl = document.getElementById('deleteModal');
const deleteText = document.getElementById('deleteText');
const confirmDelete = document.getElementById('confirmDelete');
const cancelDelete = document.getElementById('cancelDelete');

let userModal, deleteModal;
document.addEventListener('DOMContentLoaded', () => {
    activarModal = new bootstrap.Modal(activarModalEl);

    activarForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = activarUserId.value;
        const nuevoRol = activarRol.value;
        if (!id || !nuevoRol) return;
        try {
            checkAuth();
            await apiFetch(`/users/${id}/activar`, { method: 'PUT', body: JSON.stringify({ rol: nuevoRol }) });
            activarModal.hide();
            mostrarAnimacionExito('¡Usuario activado!');
            await loadUsers();
        } catch (err) {
            alert('Error activando usuario: ' + (err.message || err));
        }
    });
    // Bloquear acceso a usuarios desactivados
    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.rol === 'desactivado') {
            alert('Tu usuario ha sido desactivado. Contacta al administrador.');
            window.location.href = location.origin + '/frontend/login.html';
            return;
        }
    } catch (e) {}
    userModal = new bootstrap.Modal(userModalEl);
    deleteModal = new bootstrap.Modal(deleteModalEl);

    globalFilter.addEventListener('input', () => renderTable(usersCache));
    btnNewUser.addEventListener('click', () => openUserModal(null));
    cancelUser.addEventListener('click', () => closeUserModal());
    cancelDelete.addEventListener('click', () => closeDeleteModal());
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            console.debug('[users] submit user form');
            checkAuth();
            const id = userId.value;
            const payload = { nombre: userNombre.value.trim(), correo: userCorreo.value.trim(), rol: userRol.value };
            if (userPassword.value) payload.password = userPassword.value;
            if (id) {
                console.debug('[users] updating', id, payload);
                await apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            else {
                console.debug('[users] creating', payload);
                await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
            }
            closeUserModal();
            mostrarAnimacionExito('¡Usuario guardado!');
            await loadUsers();
        } catch (err) { console.error('save user', err); alert('Error guardando usuario: ' + (err.message || err)); }
    });
    confirmDelete.addEventListener('click', async () => {
        if (!deletingUserId) return;
        try {
            console.debug('[users] deleting', deletingUserId);
            checkAuth();
            await apiFetch(`/users/${deletingUserId}`, { method: 'DELETE' });
            closeDeleteModal();
            mostrarAnimacionExito('¡Usuario eliminado!');
            await loadUsers();
        } catch (err) {
            console.error('delete user', err);
            alert('Error eliminando usuario: ' + (err.message || err));
        }
    });
    // delete from modal handler
    deleteFromModal?.addEventListener('click', () => {
        const id = userId.value; if (!id) return; const u = usersCache.find(x => String(x.id) === String(id)); if (!u) return; openDeleteModal(u); closeUserModal();
    });

    // initial
    checkAuth();
    loadUsers();
});

let usersCache = [];
let deletingUserId = null;

function openUserModal(u) {
    userId.value = u?.id || '';
    userNombre.value = u?.nombre || '';
    userCorreo.value = u?.correo || '';
    userPassword.value = '';
    userRol.value = u?.rol || 'salonero';
    document.getElementById('userModalTitle').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
    if (!userModal) userModal = new bootstrap.Modal(userModalEl);
    userModal.show();
}

function closeUserModal() { if (userModal) userModal.hide(); }

function openDeleteModal(u) {
    deletingUserId = u.id;
    deleteText.textContent = `¿Eliminar usuario ${u.nombre} (${u.correo})?`;
    if (!deleteModal) deleteModal = new bootstrap.Modal(deleteModalEl);
    deleteModal.show();
}
function closeDeleteModal() { if (deleteModal) deleteModal.hide(); deletingUserId = null; }

async function loadUsers() {
    try {
        checkAuth();
        usersCache = await apiFetch('/users');
        renderTable(usersCache);
    } catch (e) {
        console.error('loadUsers error', e);
        tablaBody.innerHTML = `<tr><td colspan="4">Error cargando usuarios: ${e.message || e}</td></tr>`;
    }
}

function renderTable(list) {
    const q = (globalFilter.value || '').toLowerCase();
    const activos = list.filter(u => u.rol !== 'desactivado' && `${u.nombre} ${u.correo} ${u.rol}`.toLowerCase().includes(q));
    const desactivados = list.filter(u => u.rol === 'desactivado' && `${u.nombre} ${u.correo} ${u.rol}`.toLowerCase().includes(q));

    // Render activos
    if (activos.length === 0) {
        tablaBody.innerHTML = '<tr><td colspan="4">No hay usuarios</td></tr>';
    } else {
        tablaBody.innerHTML = activos.map(u => `
            <tr data-id="${u.id}">
                <td>${u.id}</td>
                <td>${u.nombre}</td>
                <td>${u.correo}</td>
                <td>${u.rol}</td>
                <td class="acciones-cell">
                    <button class="btn btn-outline-primary btn-sm btn-action edit me-1" data-id="${u.id}" aria-label="Editar ${u.nombre}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-outline-danger btn-sm btn-action delete" data-id="${u.id}" aria-label="Eliminar ${u.nombre}"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // Sección de usuarios desactivados
    let desactSection = document.getElementById('usuariosDesactivados');
    if (!desactSection) {
        desactSection = document.createElement('tbody');
        desactSection.id = 'usuariosDesactivados';
        tablaBody.parentElement.appendChild(desactSection);
    }
    if (desactivados.length === 0) {
        desactSection.innerHTML = '';
    } else {
        desactSection.innerHTML = `<tr><td colspan="5" class="text-secondary fw-bold">Usuarios desactivados</td></tr>` +
            desactivados.map(u => `
                <tr data-id="${u.id}" class="table-warning">
                    <td>${u.id}</td>
                    <td>${u.nombre}</td>
                    <td>${u.correo}</td>
                    <td>${u.rol}</td>
                    <td><button class="btn btn-success btn-sm btn-activar" data-id="${u.id}" data-nombre="${u.nombre}">Activar</button></td>
                </tr>
            `).join('');
    }
    // Botón activar
    desactSection.querySelectorAll('button.btn-activar').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const id = btn.getAttribute('data-id');
            activarUserId.value = id;
            activarRol.value = 'salonero';
            activarModal.show();
        });
    });
    // make rows clickable to edit (except when clicking an action button)
    tablaBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (ev) => {
            // ignore clicks coming from action buttons
            if (ev.target.closest('.btn-action')) return;
            const id = row.getAttribute('data-id');
            const u = usersCache.find(x => String(x.id) === String(id));
            if (u) openUserModal(u);
        });
    });

    // wire action buttons
    tablaBody.querySelectorAll('button.btn-action.edit').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const id = btn.getAttribute('data-id');
            const u = usersCache.find(x => String(x.id) === String(id));
            if (u) openUserModal(u);
        });
    });

    tablaBody.querySelectorAll('button.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const id = btn.getAttribute('data-id');
            const u = usersCache.find(x => String(x.id) === String(id));
            if (u) openDeleteModal(u);
        });
    });
}

// Animación de éxito
function mostrarAnimacionExito(texto) {
    let modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body text-center py-4">
                    <div class="mb-3">
                        <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0f7fa"/><polyline points="18,34 28,44 46,22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <div class="fs-5">${texto || '¡Éxito!'}</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    setTimeout(() => {
        bsModal.hide();
        modal.remove();
    }, 1800);
}

// initial
checkAuth();
loadUsers();
