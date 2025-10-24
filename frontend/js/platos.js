import { API_URL, authHeaders, getToken, checkAuth, apiFetch } from "./common.js";
checkAuth();

let platos = [];

// Referencias al DOM
const nuevoPlatoBtn = document.getElementById("nuevoPlatoBtn");
const platoModalEl = document.getElementById("platoModal");
const formPlato = document.getElementById("formPlato");
const platoIdInput = document.getElementById("platoId");
const nombreInput = document.getElementById("nombrePlato");
const precioInput = document.getElementById("precioPlato");
const categoriaInput = document.getElementById("categoriaPlato");
const estadoInput = document.getElementById("estadoPlato");
const listaPlatos = document.getElementById("listaPlatos");
const deletePlatoModalEl = document.getElementById('deletePlatoModal');
const deletePlatoText = document.getElementById('deletePlatoText');
const confirmDeletePlato = document.getElementById('confirmDeletePlato');

// Bootstrap modal instances
let platoModal = null;
let deletePlatoModal = null;
document.addEventListener('DOMContentLoaded', () => {
    if (window.bootstrap && platoModalEl) {
        platoModal = new bootstrap.Modal(platoModalEl);
    }
    if (window.bootstrap && deletePlatoModalEl) {
        deletePlatoModal = new bootstrap.Modal(deletePlatoModalEl);
    }
});

// ==========================
function showPlatoExitoModal(mensaje = "¡Plato guardado exitosamente!") {
    let modal = document.getElementById('modalPlatoExito');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalPlatoExito';
        modal.className = 'modal-exito-pago';
        modal.innerHTML = `
            <div class="modal-exito-content">
                <div class="checkmark-animation">
                    <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e0f7fa"/><polyline points="18,34 28,44 46,22" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="exito-text">${mensaje}</div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 1800);
}

nuevoPlatoBtn.addEventListener("click", () => {
    platoIdInput.value = "";
    nombreInput.value = "";
    precioInput.value = "";
    categoriaInput.value = "";
    document.getElementById("platoModalTitle").textContent = "Nuevo plato";
    if (!platoModal) {
      platoModal = new bootstrap.Modal(platoModalEl);
    }
    platoModal.show();
    setTimeout(() => nombreInput.focus(), 150);
});
// Cargar platos desde el backend
// ==========================
async function cargarPlatos() {
    try {
        platos = await apiFetch("/platos", { headers: authHeaders(), credentials: 'include' });
        actualizarUI();
    } catch (error) {
        console.error("Error cargando platos:", error);
    }
}

let filtroGlobalPlato = '';
let paginaPlatos = 1;
const platosPorPagina = 15;

// Crear input de filtro global si no existe
let filtroInput = document.getElementById('filtroNombrePlato');
if (!filtroInput) {
    filtroInput = document.createElement('input');
    filtroInput.id = 'filtroNombrePlato';
    filtroInput.type = 'text';
    filtroInput.placeholder = 'Filtrar por nombre, categoría o estado...';
    filtroInput.style = 'margin-bottom:12px;max-width:220px;display:block;';
    listaPlatos.parentElement.insertBefore(filtroInput, listaPlatos);
}
filtroInput.addEventListener('input', () => {
    filtroGlobalPlato = filtroInput.value.trim().toLowerCase();
    paginaPlatos = 1;
    actualizarUI();
});

// ==========================
// Actualizar tabla de platos
// ==========================
function actualizarUI() {
    listaPlatos.innerHTML = "";
    let filtrados = filtroGlobalPlato
        ? platos.filter(p =>
            p.nombre.toLowerCase().includes(filtroGlobalPlato) ||
            p.categoria.toLowerCase().includes(filtroGlobalPlato) ||
            p.estado.toLowerCase().includes(filtroGlobalPlato)
        )
        : platos;
    // Paginación
    const totalPaginas = Math.ceil(filtrados.length / platosPorPagina) || 1;
    paginaPlatos = Math.min(paginaPlatos, totalPaginas);
    const inicio = (paginaPlatos - 1) * platosPorPagina;
    const fin = inicio + platosPorPagina;
    const paginaArr = filtrados.slice(inicio, fin);
    paginaArr.forEach(p => {
        const tr = document.createElement("tr");
        const estadoHtml = p.estado === 'agotado'
            ? '<span style="color:#e11d48;font-weight:600;">Agotado</span>'
            : '<span style="color:#10b981;font-weight:600;">Disponible</span>';
        const btnAccion = p.estado === 'agotado'
            ? `<button onclick="eliminarPlato(${p.id})">Activar</button>`
            : `<button onclick="eliminarPlato(${p.id})">Eliminar</button>`;
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.nombre}</td>
            <td>$${p.precio.toFixed(2)}</td>
            <td>${p.categoria}</td>
            <td>${estadoHtml}</td>
            <td>
                <button onclick="editarPlato(${p.id})">Editar</button>
                ${btnAccion}
            </td>
        `;
        listaPlatos.appendChild(tr);
    });
    // Controles de paginación
    let paginacionDiv = document.getElementById('paginacionPlatos');
    if (!paginacionDiv) {
        paginacionDiv = document.createElement('div');
        paginacionDiv.id = 'paginacionPlatos';
        listaPlatos.parentElement.appendChild(paginacionDiv);
    }
    paginacionDiv.innerHTML = `<div style=\"margin:12px 0;text-align:center;\">
        <button ${paginaPlatos === 1 ? 'disabled' : ''} id=\"platosPrev\">Anterior</button>
        <span style=\"margin:0 12px;\">Página ${paginaPlatos} de ${totalPaginas}</span>
        <button ${paginaPlatos === totalPaginas ? 'disabled' : ''} id=\"platosNext\">Siguiente</button>
    </div>`;
    document.getElementById('platosPrev').onclick = () => { paginaPlatos = Math.max(1, paginaPlatos - 1); actualizarUI(); };
    document.getElementById('platosNext').onclick = () => { paginaPlatos = Math.min(totalPaginas, paginaPlatos + 1); actualizarUI(); };
}

// ==========================
// Crear o editar plato
// ==========================
formPlato.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = platoIdInput.value;
    const nombre = nombreInput.value.trim();
    const precio = parseFloat(precioInput.value);
    const categoria = categoriaInput.value.trim();
    const estado = estadoInput.value;

    if (!nombre || isNaN(precio) || !categoria || !estado) return alert("Todos los campos son obligatorios");

    try {
        if (id) {
            // Editar plato
            await fetch(`${API_URL}/platos/${id}`, {
                method: "PUT",
                headers: authHeaders(),
                body: JSON.stringify({ nombre, precio, categoria, estado }),
                credentials: 'include'
            });
        } else {
            // Crear plato
            await fetch(`${API_URL}/platos`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ nombre, precio, categoria, estado }),
                credentials: 'include'
            });
        }
        formPlato.reset();
        platoIdInput.value = "";
        if (!platoModal) {
          platoModal = new bootstrap.Modal(platoModalEl);
        }
        platoModal.hide();
        showPlatoExitoModal(id ? "¡Plato editado exitosamente!" : "¡Plato guardado exitosamente!");
        await cargarPlatos();
    } catch (error) {
        console.error("Error guardando plato:", error);
    }
});

// ==========================
// Editar plato (cargar datos en el formulario)
// ==========================
window.editarPlato = (id) => {
        const plato = platos.find(p => p.id === id);
        if (!plato) return;
        platoIdInput.value = plato.id;
        nombreInput.value = plato.nombre;
        precioInput.value = plato.precio;
        categoriaInput.value = plato.categoria;
        estadoInput.value = plato.estado || 'disponible';
        document.getElementById("platoModalTitle").textContent = "Editar plato";
        if (!platoModal) {
            platoModal = new bootstrap.Modal(platoModalEl);
        }
        platoModal.show();
        setTimeout(() => nombreInput.focus(), 150);
};

// --- Modal eliminar plato ---
let platoAEliminar = null;
window.eliminarPlato = (id) => {
    const plato = platos.find(p => p.id === id);
    if (!plato) return;
    platoAEliminar = plato;
    if (plato.estado === 'agotado') {
        deletePlatoText.textContent = `¿Seguro que quieres activar el plato "${plato.nombre}"?`;
    } else {
        deletePlatoText.textContent = `¿Seguro que quieres marcar el plato "${plato.nombre}" como agotado?`;
    }
    if (!deletePlatoModal) {
      deletePlatoModal = new bootstrap.Modal(deletePlatoModalEl);
    }
    deletePlatoModal.show();
};

if (confirmDeletePlato) {
  confirmDeletePlato.onclick = async () => {
      if (!platoAEliminar) return;
      try {
          // Cambiar estado según el actual
          const nuevoEstado = platoAEliminar.estado === 'agotado' ? 'disponible' : 'agotado';
          const res = await fetch(`${API_URL}/platos/${platoAEliminar.id}`, {
              method: "PUT",
              headers: authHeaders(),
              body: JSON.stringify({
                  nombre: platoAEliminar.nombre,
                  precio: platoAEliminar.precio,
                  categoria: platoAEliminar.categoria,
                  estado: nuevoEstado
              }),
              credentials: 'include'
          });
          if (!res.ok) {
              let msg = nuevoEstado === 'disponible' ? "No se pudo activar el plato." : "No se pudo marcar como agotado.";
              showPlatoExitoModal(msg);
          } else {
              let msg = nuevoEstado === 'disponible' ? "¡Plato activado!" : "¡Plato marcado como agotado!";
              showPlatoExitoModal(msg);
              await cargarPlatos();
          }
      } catch (error) {
          let msg = platoAEliminar.estado === 'agotado' ? "No se pudo activar el plato." : "No se pudo marcar como agotado.";
          showPlatoExitoModal(msg);
          console.error("Error actualizando plato:", error);
      }
      platoAEliminar = null;
      if (deletePlatoModal) deletePlatoModal.hide();
  };
}

// ==========================
// Inicializar
// ==========================
cargarPlatos();
