// Modal animado de pago realizado con éxito
function showPagoExitoModal(texto) {
    let modal = document.getElementById('modalPagoExito');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalPagoExito';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content text-center">
                    <div class="modal-body py-4">
                        <div class="mb-3">
                            <i class="bi bi-check-circle-fill text-success" style="font-size:3rem;"></i>
                        </div>
                        <div class="fs-5">${texto || '¡Pago realizado con éxito!'}</div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    setTimeout(() => {
        bsModal.hide();
    }, 1500);
}
import { API_URL, authHeaders, checkAuth, apiFetch } from "./common.js";
checkAuth();

checkAuth();

// conectar socket al servidor (usar la URL raíz del servidor, sin '/api')
const socket = io(API_URL.replace(/\/api\/?$/, ''));

socket.on('connect', () => console.log('Socket conectado (pagos):', socket.id));
let ordenesParaPago = []; // Solo entregadas
let platos = []; // Para mostrar nombres y precios

const pagosMesasDiv = document.getElementById("pagosMesas");

// ==========================
// Cargar datos iniciales
// ==========================
async function cargarDatosPago() {
    try {
        // Platos para mostrar nombres y precios
        platos = await apiFetch("/platos", { headers: authHeaders() });

        // Todas las órdenes entregadas que aún no tienen tipoPago
        const ordenes = await apiFetch("/ordenes", { headers: authHeaders() });
        // Agrupar por mesa
        const mesas = {};
        ordenes.forEach(o => {
            if (o.estado === "entregada" && (!o.tipoPago || o.tipoPago === '')) {
                const mesaId = o.mesa ? o.mesa.id : o.mesaId;
                if (!mesas[mesaId]) mesas[mesaId] = { mesa: o.mesa || { id: mesaId, nombre: `Mesa #${mesaId}` }, ordenes: [], total: 0 };
                mesas[mesaId].ordenes.push(o);
                mesas[mesaId].total += o.total;
            }
        });
        ordenesParaPago = mesas;
        actualizarUI();
    } catch (error) {
        console.error("Error cargando órdenes para pago:", error);
    }
}

// ==========================
// Actualizar tabla de pagos
// ==========================
function actualizarUI() {
    pagosMesasDiv.innerHTML = "";
    const mesas = Object.values(ordenesParaPago);
    if (mesas.length === 0) {
        pagosMesasDiv.innerHTML = `<div class="alert alert-info text-center mt-5">No hay órdenes pendientes de pago.</div>`;
        return;
    }
    mesas.forEach(mesaObj => {
        // Calcular subtotal, iva y servicio para la mesa
        let subtotal = 0;
        mesaObj.ordenes.forEach(o => {
            o.items.forEach(i => {
                const plato = platos.find(p => p.id === i.platoId);
                if (plato) subtotal += plato.precio * i.cantidad;
            });
        });
        subtotal = Math.round(subtotal * 100) / 100;
        const iva = Math.round(subtotal * 0.13 * 100) / 100;
        // Si la mesa es null, no mostrar servicio
        const mostrarServicio = mesaObj.mesa && mesaObj.mesa.id !== null && mesaObj.mesa.id !== undefined;
        const servicio = mostrarServicio ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
        const total = Math.round((subtotal + iva + servicio) * 100) / 100;
        const mesaDiv = document.createElement("div");
        mesaDiv.className = "card mb-4 shadow-sm";
        mesaDiv.innerHTML = `
            <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h4 class="mb-0">${mesaObj.mesa.nombre}</h4>
                <span class="badge bg-info text-dark">Total: $${total.toFixed(2)}</span>
            </div>
            <div class="card-body">
                <div class="mb-2"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</div>
                <div class="mb-2"><strong>IVA (13%):</strong> $${iva.toFixed(2)}</div>
                ${mostrarServicio ? `<div class="mb-2"><strong>Servicio (10%):</strong> $${servicio.toFixed(2)}</div>` : ''}
                <div class="mb-2"><strong>Órdenes:</strong></div>
                <div class="row g-2">
                    ${mesaObj.ordenes.map(o => `
                        <div class="col-12 col-md-6">
                            <div class="border rounded p-2 mb-2 bg-light">
                                <div class="fw-semibold mb-1">Orden #${o.id}</div>
                                <ul class="mb-1 ps-3">
                                    ${o.items.map(i => {
                                        const plato = platos.find(p => p.id === i.platoId);
                                        return `<li>${plato ? plato.nombre : i.platoId} x${i.cantidad} <span class='badge bg-secondary'>$${plato ? plato.precio.toFixed(2) : 0}</span></li>`;
                                    }).join("")}
                                </ul>
                                <div class="text-end small text-muted">Total orden: $${o.total.toFixed(2)}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    <select id="tipoPago-mesa-${mesaObj.mesa.id}" class="form-select w-auto">
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="sinpe">Sinpe</option>
                    </select>
                    <button class="btn btn-success" onclick="window.pagarMesa(${mesaObj.mesa.id})"><i class="bi bi-cash-coin me-1"></i>Pagar todo</button>
                    <button class="btn btn-outline-primary" onclick="window.dividirPagoMesa(${mesaObj.mesa.id})"><i class="bi bi-scissors me-1"></i>Dividir pago</button>
                </div>
                <div id="dividirPagoForm-${mesaObj.mesa.id}" style="display:none;margin-top:10px;"></div>
            </div>
        `;
        pagosMesasDiv.appendChild(mesaDiv);
    });
}

// ==========================
// Pagar toda la mesa
// ==========================
window.pagarMesa = async (mesaId) => {
    const tipoPago = document.getElementById(`tipoPago-mesa-${mesaId}`).value;
    const mesaObj = ordenesParaPago[mesaId];
    if (!mesaObj) return;
    try {
        // Pagar todas las órdenes de la mesa
        for (const orden of mesaObj.ordenes) {
            const res = await fetch(`${API_URL}/ordenes/${orden.id}/pagar`, {
                method: "POST",
                headers: { ...authHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ tipoPago }),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Error pagando orden');
            await res.json();
        }
        // Eliminar la mesa del listado
        delete ordenesParaPago[mesaId];
        actualizarUI();
    showPagoExitoModal("¡Pago realizado exitosamente!");
    } catch (error) {
        console.error("Error pagando mesa:", error);
    }
};

// ==========================
// Dividir pago de la mesa
// ==========================
window.dividirPagoMesa = (mesaId) => {
    const formDiv = document.getElementById(`dividirPagoForm-${mesaId}`);
    if (!formDiv) return;
    formDiv.style.display = "block";
    const mesaObj = ordenesParaPago[mesaId];
    // Modal para seleccionar platos y cantidades
    let modal = document.getElementById('modalDividirPago');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalDividirPago';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" id="modalDividirPagoContent"></div>
        </div>`;
        document.body.appendChild(modal);
    }
    const modalContent = modal.querySelector('#modalDividirPagoContent');
    // Renderizar formulario de selección de platos
    let platosDisponibles = [];
    mesaObj.ordenes.forEach(o => {
        o.items.forEach(item => {
            const plato = platos.find(p => p.id === item.platoId);
            if (plato) {
                platosDisponibles.push({
                    platoId: plato.id,
                    nombre: plato.nombre,
                    precio: plato.precio,
                    cantidad: item.cantidad,
                    detalles: item.detalles || ''
                });
            }
        });
    });
    // Agrupar platos iguales con mismos detalles
    const agrupados = {};
    platosDisponibles.forEach(p => {
        const key = p.platoId + '|' + p.detalles;
        if (!agrupados[key]) agrupados[key] = { ...p };
        else agrupados[key].cantidad += p.cantidad;
    });
    // Formulario
        modalContent.innerHTML = `
                <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">Dividir pago de ${mesaObj.mesa.nombre}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                        <form id="formDividirPagoModal" class="d-flex flex-column gap-3">
                                <div id="platosDividirPago"></div>
                                <div class="d-flex gap-2 align-items-center">
                                        <select id="tipoDividirPagoModal" class="form-select w-auto">
                                                <option value="efectivo">Efectivo</option>
                                                <option value="tarjeta">Tarjeta</option>
                                                <option value="sinpe">Sinpe</option>
                                        </select>
                                        <button type="submit" class="btn btn-success">Registrar pago parcial</button>
                                        <button type="button" class="btn btn-secondary" id="cancelarDividirPago">Cancelar</button>
                                </div>
                        </form>
                        <div id="pagosParcialesMesa-${mesaId}" class="mt-3"></div>
                </div>
        `;
    // Renderizar selección de platos y cantidades
    const platosDiv = modalContent.querySelector('#platosDividirPago');
    platosDiv.innerHTML = Object.values(agrupados).map((p, idx) => {
        return `<div class="d-flex align-items-center gap-2 mb-2">
            <span class="fw-semibold">${p.nombre}${p.detalles ? ' (' + p.detalles + ')' : ''}</span>
            <span class="badge bg-info text-dark">$${p.precio.toFixed(2)}</span>
            <span>x</span>
            <select id="cantidadDividir-${idx}" class="form-select form-select-sm w-auto">
                ${Array.from({ length: p.cantidad + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
            </select>
        </div>`;
    }).join('');
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modalContent.querySelector('#cancelarDividirPago').onclick = () => {
        bsModal.hide();
    };
    modal.querySelector('.btn-close').onclick = () => {
        bsModal.hide();
    };
    // Registrar pago parcial usando backend
    modalContent.querySelector('#formDividirPagoModal').onsubmit = async (e) => {
        e.preventDefault();
        // Calcular platos seleccionados y validar duplicidad/exceso
        const platosPagados = [];
        const cantidadesPorPlato = {};
        Object.values(agrupados).forEach((p, idx) => {
            const cant = parseInt(document.getElementById(`cantidadDividir-${idx}`).value);
            if (cant > 0) {
                const key = p.platoId + '|' + p.detalles;
                cantidadesPorPlato[key] = (cantidadesPorPlato[key] || 0) + cant;
                if (cantidadesPorPlato[key] > p.cantidad) {
                    alert(`No puede seleccionar más de ${p.cantidad} para ${p.nombre}${p.detalles ? ' (' + p.detalles + ')' : ''}`);
                    return;
                }
                platosPagados.push({ platoId: p.platoId, detalles: p.detalles, cantidad: cant });
            }
        });
        if (Object.values(cantidadesPorPlato).some((val, idx) => val > Object.values(agrupados)[idx].cantidad)) {
            return;
        }
        const tipoPago = document.getElementById('tipoDividirPagoModal').value;
        if (platosPagados.length === 0) {
            alert('Seleccione al menos un plato para pagar.');
            return;
        }
        // Enviar pago parcial a backend para cada orden afectada
        let pagoTotal = 0;
        let breakdown = null;
        let error = null;
        for (const orden of mesaObj.ordenes) {
            // Filtrar platosPagados que están en esta orden
            const platosEnOrden = platosPagados.filter(p => orden.items.some(item => item.platoId === p.platoId && (item.detalles || '') === (p.detalles || '')));
            if (platosEnOrden.length === 0) continue;
            try {
                const res = await fetch(`${API_URL}/ordenes/${orden.id}/pago-parcial`, {
                    method: "POST",
                    headers: { ...authHeaders(), "Content-Type": "application/json" },
                    body: JSON.stringify({ tipoPago, platos: platosEnOrden }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Error registrando pago parcial');
                const data = await res.json();
                pagoTotal += data.montoFinal || data.total;
                breakdown = data;
                // Quitar platos pagados de la orden
                platosEnOrden.forEach(pagado => {
                    orden.items = orden.items.map(item => {
                        if (item.platoId === pagado.platoId && (item.detalles || '') === (pagado.detalles || '')) {
                            if (item.cantidad > pagado.cantidad) {
                                return { ...item, cantidad: item.cantidad - pagado.cantidad };
                            } else {
                                return null;
                            }
                        }
                        return item;
                    }).filter(Boolean);
                });
                // Recalcular total de la orden
                orden.total = orden.items.reduce((s, it) => {
                    const plato = platos.find(p => p.id === it.platoId);
                    return s + (plato ? plato.precio * it.cantidad : 0);
                }, 0);
            } catch (err) {
                error = err;
            }
        }
        if (error) {
            alert('Error registrando pago parcial.');
            return;
        }
        // Mostrar mensaje de éxito y breakdown
        let breakdownHtml = '';
        if (breakdown) {
            breakdownHtml = `<div style="margin-top:8px;"><strong>Desglose del pago:</strong><br>
                Subtotal: $${breakdown.subtotal?.toFixed(2) || '0.00'}<br>
                IVA (13%): $${breakdown.iva?.toFixed(2) || '0.00'}<br>
                Servicio (10%): $${breakdown.servicio?.toFixed(2) || '0.00'}<br>
                <strong>Total pagado:</strong> $${breakdown.montoFinal?.toFixed(2) || breakdown.total?.toFixed(2) || '0.00'}</div>`;
        }
    // Cerrar el modal correctamente usando Bootstrap
    const dividirModalInstance = bootstrap.Modal.getOrCreateInstance(modal);
    dividirModalInstance.hide();
    showPagoExitoModal('¡Pago realizado con éxito!');
        // Eliminar órdenes que ya no tienen items
        mesaObj.ordenes = mesaObj.ordenes.filter(o => o.items.length > 0);
        // Recalcular total de la mesa
        mesaObj.total = mesaObj.ordenes.reduce((s, o) => s + o.total, 0);
        // Mostrar pagos parciales (sin breakdown)
        mesaObj.pagosParciales = mesaObj.pagosParciales || [];
        mesaObj.pagosParciales.push({ monto: pagoTotal, tipoPago });
        const pagosDiv = modalContent.querySelector(`#pagosParcialesMesa-${mesaId}`);
        const totalPagado = mesaObj.pagosParciales.reduce((s, p) => s + p.monto, 0);
        pagosDiv.innerHTML = `<strong>Pagos parciales:</strong> ${mesaObj.pagosParciales.map(p => `$${p.monto.toFixed(2)} (${p.tipoPago})`).join(', ')}<br><strong>Total pagado:</strong> $${totalPagado.toFixed(2)}`;
        // Si se completó el pago, marcar todas las órdenes como pagadas
        if (mesaObj.total <= 0) {
            for (const orden of mesaObj.ordenes) {
                await fetch(`${API_URL}/ordenes/${orden.id}/pagar`, {
                    method: "POST",
                    headers: { ...authHeaders(), "Content-Type": "application/json" },
                    body: JSON.stringify({ tipoPago }),
                    credentials: 'include'
                });
            }
            delete ordenesParaPago[mesaId];
            actualizarUI();
        showPagoExitoModal("¡Pago dividido exitosamente!");
        } else {
            actualizarUI();
            showPagoExitoModal();
        }
    };
};

// ==========================
// Recibir nuevas órdenes entregadas por socket
// ==========================
socket.on("ordenEntregada", (orden) => {
    // Añadir sólo si no tiene tipoPago (a veces el payload puede venir ya con tipoPago)
    // Aceptar undefined, null o cadena vacía
    if (!orden.tipoPago || orden.tipoPago === '') {
        console.log('Pagos: recibiendo orden entregada por socket id=', orden.id);
        ordenesParaPago.push(orden);
    } else {
        console.log('Pagos: orden entregada ignorada porque ya tiene tipoPago=', orden.tipoPago);
    }
    actualizarUI();
});

// ==========================
// Inicializar
// ==========================
cargarDatosPago();
