import { API_URL, authHeaders, apiFetch, checkAuth } from './common.js';
checkAuth();

const tablaPagosBody = document.querySelector('#tablaPagos tbody');
const tablaOrdenesBody = document.querySelector('#tablaOrdenes tbody');
const descargarPagosPDF = document.getElementById('descargarPagosPDF');
const descargarPagosExcel = document.getElementById('descargarPagosExcel');
const descargarOrdenesPDF = document.getElementById('descargarOrdenesPDF');
const descargarOrdenesExcel = document.getElementById('descargarOrdenesExcel');
const filtroPagos = document.getElementById('filtroPagos');
const filtroOrdenes = document.getElementById('filtroOrdenes');

let pagosRaw = [];
let ordenesRaw = [];
// Paginación
let pagosPagina = 1;
let ordenesPagina = 1;
const pagosPorPagina = 15;
const ordenesPorPagina = 15;
// Cargar datos de pagos y órdenes
async function cargarReportes() {
    try {
        // Suponiendo endpoints /pagos-orden y /ordenes
        const pagos = await apiFetch('/pagos-orden');
        const ordenes = await apiFetch('/ordenes');
    pagosRaw = pagos;
    ordenesRaw = ordenes;
    renderPagos(pagosRaw);
    renderOrdenes(ordenesRaw);
    } catch (err) {
    tablaPagosBody.innerHTML = `<tr><td colspan="5"><div class='alert alert-danger text-center my-2'>Error cargando pagos: ${err.message}</div></td></tr>`;
    tablaOrdenesBody.innerHTML = `<tr><td colspan="11"><div class='alert alert-danger text-center my-2'>Error cargando órdenes: ${err.message}</div></td></tr>`;
    }
}

function renderPagos(pagos) {
    // Paginación
    const totalPaginas = Math.ceil(pagos.length / pagosPorPagina) || 1;
    pagosPagina = Math.min(pagosPagina, totalPaginas);
    const inicio = (pagosPagina - 1) * pagosPorPagina;
    const fin = inicio + pagosPorPagina;
    const pagosPaginaArr = pagos.slice(inicio, fin);
    // Calcular totales globales
    const totalMonto = pagos.reduce((acc, p) => acc + (p.monto || 0), 0);
    const totalCount = pagos.length;
    tablaPagosBody.innerHTML = pagosPaginaArr.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.ordenId}</td>
            <td>$${Number(p.monto).toFixed(2)}</td>
            <td>${p.tipoPago}</td>
            <td>${p.fecha ? new Date(p.fecha).toLocaleString() : ''}</td>
        </tr>
    `).join('');
    // Fila de totales
    tablaPagosBody.innerHTML += `
        <tr style="background:#f3f4f6;font-weight:700;">
            <td colspan="4" style="text-align:right;padding:8px;">Total pagos (${totalCount}):</td>
            <td style="text-align:right;padding:8px;">$${totalMonto.toFixed(2)}</td>
        </tr>
    `;
    // Controles de paginación
    const paginacionDiv = document.getElementById('paginacionPagos');
    if (paginacionDiv) {
        paginacionDiv.innerHTML = '';
    } else {
        const div = document.createElement('div');
        div.id = 'paginacionPagos';
        tablaPagosBody.parentElement.appendChild(div);
    }
    const paginacion = document.getElementById('paginacionPagos');
    paginacion.innerHTML = `
    <div class="d-flex justify-content-center align-items-center gap-2 my-3">
        <button ${pagosPagina === 1 ? 'disabled' : ''} id="pagosPrev" class="btn btn-outline-secondary btn-sm">Anterior</button>
        <span class="fw-semibold">Página ${pagosPagina} de ${totalPaginas}</span>
        <button ${pagosPagina === totalPaginas ? 'disabled' : ''} id="pagosNext" class="btn btn-outline-secondary btn-sm">Siguiente</button>
    </div>`;
    document.getElementById('pagosPrev').onclick = () => { pagosPagina = Math.max(1, pagosPagina - 1); renderPagos(filtrarPagos(filtroPagos.value)); };
    document.getElementById('pagosNext').onclick = () => { pagosPagina = Math.min(totalPaginas, pagosPagina + 1); renderPagos(filtrarPagos(filtroPagos.value)); };
}

function renderOrdenes(ordenes) {
    // Paginación
    const totalPaginas = Math.ceil(ordenes.length / ordenesPorPagina) || 1;
    ordenesPagina = Math.min(ordenesPagina, totalPaginas);
    const inicio = (ordenesPagina - 1) * ordenesPorPagina;
    const fin = inicio + ordenesPorPagina;
    const ordenesPaginaArr = ordenes.slice(inicio, fin);

    // Calcular totales globales (de todos los datos filtrados, no solo la página)
    const totalTotal = ordenes.reduce((acc, o) => acc + (o.total || 0), 0);
    const totalIva = ordenes.reduce((acc, o) => acc + (o.iva || 0), 0);
    const totalServicio = ordenes.reduce((acc, o) => acc + (o.servicio || 0), 0);
    const totalMontoFinal = ordenes.reduce((acc, o) => acc + (o.montoFinal || 0), 0);
    const totalOrdenes = ordenes.length;

    tablaOrdenesBody.innerHTML = ordenesPaginaArr.map(o => {
        // Platos: nombre x cantidad (detalles)
        const platos = o.items?.map(it => {
            let txt = `${it.plato?.nombre || ''} x${it.cantidad}`;
            if (it.detalles) txt += ` (${it.detalles})`;
            return txt;
        }).join('<br>') || '';
        return `
        <tr>
            <td>${o.id}</td>
            <td>${o.usuario?.nombre || ''}</td>
            <td>${o.mesa?.nombre || o.mesaId || ''}</td>
            <td>$${Number(o.total).toFixed(2)}</td>
            <td>${o.estado}</td>
            <td>${o.fecha ? new Date(o.fecha).toLocaleString() : ''}</td>
            <td>${o.tipoPago || ''}</td>
            <td>$${o.iva !== undefined ? Number(o.iva).toFixed(2) : ''}</td>
            <td>$${o.servicio !== undefined ? Number(o.servicio).toFixed(2) : ''}</td>
            <td>$${o.montoFinal !== undefined ? Number(o.montoFinal).toFixed(2) : ''}</td>
            <td>${platos}</td>
        </tr>
        `;
    }).join('');
    // Fila de totales
    tablaOrdenesBody.innerHTML += `
        <tr style="background:#f3f4f6;font-weight:700;">
            <td colspan="0" style="text-align:right;">Totales :</td>
            <td>Ordenes:${totalOrdenes}</td>
            <td></td>
            <td>$${totalTotal.toFixed(2)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${totalIva.toFixed(2)}</td>
            <td>$${totalServicio.toFixed(2)}</td>
            <td>$${totalMontoFinal.toFixed(2)}</td>
            <td></td>
        </tr>
    `;
    // Controles de paginación
    const paginacionDiv = document.getElementById('paginacionOrdenes');
    if (paginacionDiv) {
        paginacionDiv.innerHTML = '';
    } else {
        const div = document.createElement('div');
        div.id = 'paginacionOrdenes';
        tablaOrdenesBody.parentElement.appendChild(div);
    }
    const paginacion = document.getElementById('paginacionOrdenes');
    paginacion.innerHTML = `
    <div class="d-flex justify-content-center align-items-center gap-2 my-3">
        <button ${ordenesPagina === 1 ? 'disabled' : ''} id="ordenesPrev" class="btn btn-outline-secondary btn-sm">Anterior</button>
        <span class="fw-semibold">Página ${ordenesPagina} de ${totalPaginas}</span>
        <button ${ordenesPagina === totalPaginas ? 'disabled' : ''} id="ordenesNext" class="btn btn-outline-secondary btn-sm">Siguiente</button>
    </div>`;
    document.getElementById('ordenesPrev').onclick = () => { ordenesPagina = Math.max(1, ordenesPagina - 1); renderOrdenes(filtrarOrdenes(filtroOrdenes.value)); };
    document.getElementById('ordenesNext').onclick = () => { ordenesPagina = Math.min(totalPaginas, ordenesPagina + 1); renderOrdenes(filtrarOrdenes(filtroOrdenes.value)); };
}

function filtrarPagos(texto) {
    texto = texto.trim().toLowerCase();
    if (!texto) return pagosRaw;
    return pagosRaw.filter(p => {
        return Object.values(p).some(v => (v + '').toLowerCase().includes(texto));
    });
}

filtroPagos.addEventListener('input', () => {
    renderPagos(filtrarPagos(filtroPagos.value));
});
function filtrarOrdenes(texto) {
    texto = texto.trim().toLowerCase();
    if (!texto) return ordenesRaw;
    return ordenesRaw.filter(o => {
        // Buscar en todos los campos relevantes
        const campos = [o.id, o.usuario?.nombre, o.mesa?.nombre, o.mesaId, o.total, o.estado, o.fecha, o.tipoPago, o.iva, o.servicio, o.montoFinal];
        const platos = o.items?.map(it => `${it.plato?.nombre || ''} x${it.cantidad} ${it.detalles || ''}`).join(' ');
        return [...campos, platos].some(v => (v + '').toLowerCase().includes(texto));
    });
}

filtroOrdenes.addEventListener('input', () => {
    renderOrdenes(filtrarOrdenes(filtroOrdenes.value));
});
// Descargar PDF/Excel (solo frontend, para demo; en producción usar backend)
function descargarTablaComo(tipo, tablaId, nombreArchivo) {
    // Usar solo los datos filtrados
    let rows = [];
    if (tablaId === 'tablaPagos') {
        rows = filtrarPagos(filtroPagos.value);
    } else if (tablaId === 'tablaOrdenes') {
        rows = filtrarOrdenes(filtroOrdenes.value);
    }
    if (tipo === 'excel') {
        // Usar SheetJS para generar .xlsx profesional
        let headers = [];
        let data = [];
        let titulo = tablaId === 'tablaPagos' ? 'Reporte de Pagos de Órdenes' : 'Reporte de Órdenes';
        let fecha = new Date().toLocaleString();
        if (tablaId === 'tablaPagos') {
            headers = ['ID Pago', 'ID Orden', 'Monto', 'Tipo de Pago', 'Fecha'];
            data = rows.map(p => [p.id, p.ordenId, `$${Number(p.monto).toFixed(2)}`, p.tipoPago, p.fecha ? new Date(p.fecha).toLocaleString() : '']);
            // Totales
            const totalMonto = rows.reduce((acc, p) => acc + (p.monto || 0), 0);
            const totalCount = rows.length;
            data.push([`Total pagos: ${totalCount}`, '', `$${totalMonto.toFixed(2)}`, '', '']);
        } else {
            headers = ['ID Orden', 'Usuario', 'Mesa', 'Total', 'Estado', 'Fecha', 'Tipo de Pago', 'IVA', 'Servicio', 'Monto Final', 'Platos'];
            data = rows.map(o => {
                const platos = o.items?.map(it => {
                    let txt = `${it.plato?.nombre || ''} x${it.cantidad}`;
                    if (it.detalles) txt += ` (${it.detalles})`;
                    return txt;
                }).join(' | ') || '';
                return [o.id, o.usuario?.nombre || '', o.mesa?.nombre || o.mesaId || '', `$${Number(o.total).toFixed(2)}`, o.estado, o.fecha ? new Date(o.fecha).toLocaleString() : '', o.tipoPago || '', `$${o.iva !== undefined ? Number(o.iva).toFixed(2) : ''}`, `$${o.servicio !== undefined ? Number(o.servicio).toFixed(2) : ''}`, `$${o.montoFinal !== undefined ? Number(o.montoFinal).toFixed(2) : ''}`, platos];
            });
            // Totales
            const totalTotal = rows.reduce((acc, o) => acc + (o.total || 0), 0);
            const totalIva = rows.reduce((acc, o) => acc + (o.iva || 0), 0);
            const totalServicio = rows.reduce((acc, o) => acc + (o.servicio || 0), 0);
            const totalMontoFinal = rows.reduce((acc, o) => acc + (o.montoFinal || 0), 0);
            const totalOrdenes = rows.length;
            data.push([
                `Totales (${totalOrdenes} órdenes):`, '', '', `$${totalTotal.toFixed(2)}`, '', '', '', `$${totalIva.toFixed(2)}`, `$${totalServicio.toFixed(2)}`, `$${totalMontoFinal.toFixed(2)}`, ''
            ]);
        }
        // Crear hoja con título y fecha arriba
        const ws_data = [[titulo], [`Generado: ${fecha}`], [], headers, ...data];
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        // Estilo: ancho de columnas
        const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 16) }));
        ws['!cols'] = colWidths;
        // Crear libro y descargar
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        XLSX.writeFile(wb, nombreArchivo + '.xlsx');
        return;
    } else if (tipo === 'pdf') {
        // Crear tabla HTML profesional solo con los datos filtrados
        let html = `<div style="font-family:Arial,sans-serif;padding:24px;">
            <h2 style="text-align:center;color:#1a202c;margin-bottom:8px;">${tablaId === 'tablaPagos' ? 'Reporte de Pagos de Órdenes' : 'Reporte de Órdenes'}</h2>
            <div style="text-align:right;font-size:0.95em;color:#555;margin-bottom:16px;">Generado: ${new Date().toLocaleString()}</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.98em;">
                <thead style="background:#f3f4f6;color:#222;">
        `;
        if (tablaId === 'tablaPagos') {
            html += '<tr><th style="padding:8px;border:1px solid #ccc;">ID Pago</th><th style="padding:8px;border:1px solid #ccc;">ID Orden</th><th style="padding:8px;border:1px solid #ccc;">Monto</th><th style="padding:8px;border:1px solid #ccc;">Tipo de Pago</th><th style="padding:8px;border:1px solid #ccc;">Fecha</th></tr></thead><tbody>';
            html += rows.map(p => `<tr><td style="padding:8px;border:1px solid #eee;">${p.id}</td><td style="padding:8px;border:1px solid #eee;">${p.ordenId}</td><td style="padding:8px;border:1px solid #eee;">$${Number(p.monto).toFixed(2)}</td><td style="padding:8px;border:1px solid #eee;">${p.tipoPago}</td><td style="padding:8px;border:1px solid #eee;">${p.fecha ? new Date(p.fecha).toLocaleString() : ''}</td></tr>`).join('');
            // Totales
            const totalMonto = rows.reduce((acc, p) => acc + (p.monto || 0), 0);
            const totalCount = rows.length;
            html += `<tr style=\"background:#f3f4f6;font-weight:700;\"><td colspan=\"4\" style=\"text-align:right;padding:8px;\">Total pagos (${totalCount}):</td><td style=\"text-align:right;padding:8px;\">$${totalMonto.toFixed(2)}</td></tr>`;
        } else {
            html += '<tr><th style="padding:8px;border:1px solid #ccc;">ID Orden</th><th style="padding:8px;border:1px solid #ccc;">Usuario</th><th style="padding:8px;border:1px solid #ccc;">Mesa</th><th style="padding:8px;border:1px solid #ccc;">Total</th><th style="padding:8px;border:1px solid #ccc;">Estado</th><th style="padding:8px;border:1px solid #ccc;">Fecha</th><th style="padding:8px;border:1px solid #ccc;">Tipo de Pago</th><th style="padding:8px;border:1px solid #ccc;">IVA</th><th style="padding:8px;border:1px solid #ccc;">Servicio</th><th style="padding:8px;border:1px solid #ccc;">Monto Final</th><th style="padding:8px;border:1px solid #ccc;">Platos</th></tr></thead><tbody>';
            html += rows.map(o => {
                const platos = o.items?.map(it => {
                    let txt = `${it.plato?.nombre || ''} x${it.cantidad}`;
                    if (it.detalles) txt += ` (${it.detalles})`;
                    return txt;
                }).join('<br>') || '';
                return `<tr>
                    <td style="padding:8px;border:1px solid #eee;">${o.id}</td>
                    <td style="padding:8px;border:1px solid #eee;">${o.usuario?.nombre || ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">${o.mesa?.nombre || o.mesaId || ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">$${Number(o.total).toFixed(2)}</td>
                    <td style="padding:8px;border:1px solid #eee;">${o.estado}</td>
                    <td style="padding:8px;border:1px solid #eee;">${o.fecha ? new Date(o.fecha).toLocaleString() : ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">${o.tipoPago || ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">$${o.iva !== undefined ? Number(o.iva).toFixed(2) : ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">$${o.servicio !== undefined ? Number(o.servicio).toFixed(2) : ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">$${o.montoFinal !== undefined ? Number(o.montoFinal).toFixed(2) : ''}</td>
                    <td style="padding:8px;border:1px solid #eee;">${platos}</td>
                </tr>`;
            }).join('');
            // Totales
            const totalTotal = rows.reduce((acc, o) => acc + (o.total || 0), 0);
            const totalIva = rows.reduce((acc, o) => acc + (o.iva || 0), 0);
            const totalServicio = rows.reduce((acc, o) => acc + (o.servicio || 0), 0);
            const totalMontoFinal = rows.reduce((acc, o) => acc + (o.montoFinal || 0), 0);
            const totalOrdenes = rows.length;
            html += `<tr style=\"background:#f3f4f6;font-weight:700;\"><td colspan=\"1\" style=\"text-align:right;\">Totales (${totalOrdenes} órdenes):</td><td></td><td></td><td>$${totalTotal.toFixed(2)}</td><td></td><td></td><td></td><td>$${totalIva.toFixed(2)}</td><td>$${totalServicio.toFixed(2)}</td><td>$${totalMontoFinal.toFixed(2)}</td><td></td></tr>`;
        }
        html += '</tbody></table></div>';
        // Descargar como PDF usando print-to-PDF
        const win = window.open('', '', 'width=900,height=700');
        win.document.write('<html><head><title>' + nombreArchivo + '</title></head><body>' + html + '</body></html>');
        win.document.close();
        setTimeout(() => {
            win.print();
        }, 400);
    }
}

descargarPagosPDF.onclick = () => descargarTablaComo('pdf', 'tablaPagos', 'pagos_orden');
descargarPagosExcel.onclick = () => descargarTablaComo('excel', 'tablaPagos', 'pagos_orden');
descargarOrdenesPDF.onclick = () => descargarTablaComo('pdf', 'tablaOrdenes', 'ordenes');
descargarOrdenesExcel.onclick = () => descargarTablaComo('excel', 'tablaOrdenes', 'ordenes');

cargarReportes();
