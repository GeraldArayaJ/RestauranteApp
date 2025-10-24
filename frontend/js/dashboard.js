import { apiFetch, checkAuth, verifyAuth } from "./common.js";

// Verificación de autenticación mejorada
(async function initAuth() {
    try {
        // Verificar localStorage primero
        checkAuth();
        // Luego verificar con el servidor
        await verifyAuth();
    } catch (error) {
        console.error('Error de autenticación:', error);
        window.location.href = location.origin + "/frontend/login.html";
        return;
    }
})();

const filtro = document.getElementById("filtro");
const totalVentas = document.getElementById("totalVentas");
const platoTop = document.getElementById("platoTop");
const ctx = document.getElementById("graficoVentas");
const tablaBody = document.querySelector('#tablaVentas tbody');

let ventasChart, hourlyChart, categoriesChart;

function calcularFromDate(periodo) {
    const hoy = new Date();
    let dias = 0;
    if (periodo === 'dia') dias = 0;
    else if (periodo === 'quincena') dias = 14;
    else if (periodo === 'mes') dias = 29;
    const from = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias);
    const y = from.getFullYear();
    const m = String(from.getMonth() + 1).padStart(2, '0');
    const d = String(from.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function cargarEstadisticas(periodo = "dia") {
    const from = calcularFromDate(periodo);
    try {
        // ventas por fecha (array expected)
        const maybeArray = await apiFetch(`/ordenes/estadisticas?from=${from}`);

        let labels = [];
        let valores = [];
        // support both legacy shape and new array
        if (Array.isArray(maybeArray)) {
            labels = maybeArray.map(x => x.date);
            valores = maybeArray.map(x => Number(x.totalFinal || x.montoFinal || x.total));
            // compute totals
            const total = valores.reduce((a, b) => a + b, 0);
            totalVentas.textContent = total.toFixed(2);
        } else if (maybeArray && maybeArray.fechas) {
            labels = maybeArray.fechas;
            valores = maybeArray.totales.map(Number);
            totalVentas.textContent = (maybeArray.totalFinal || 0).toFixed(2);
        } else {
            // unexpected shape
            console.warn('Formato inesperado de /estadisticas', maybeArray);
        }


        const noData = labels.length === 0 || valores.every(v => !v);
        const noDataEl = document.getElementById('noDataMsg');
        if (noData) {
            noDataEl.classList.add('show');
        } else {
            noDataEl.classList.remove('show');
        }
        // tabla de ventas
        tablaBody.innerHTML = '';
        for (let i = 0; i < labels.length; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${labels[i]}</td><td class="num">${Number(valores[i] || 0).toFixed(2)}</td>`;
            tablaBody.appendChild(tr);
        }

        // ventas chart
        if (ventasChart) ventasChart.destroy();
        ventasChart = new Chart(ctx.getContext ? ctx.getContext('2d') : ctx, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Ventas', data: valores, borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.08)', tension: 0.2 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // summary KPIs
        try {
            const summary = await apiFetch(`/ordenes/estadisticas/summary?from=${from}`);
            document.getElementById('totalVentas').textContent = (summary.totalFinal || 0).toFixed(2);
            document.getElementById('totalIva').textContent = (summary.totalIva || 0).toFixed(2);
            document.getElementById('totalServicio').textContent = (summary.totalServicio || 0).toFixed(2);
            document.getElementById('ordenesTotales').textContent = summary.ordenesTotales || 0;
            document.getElementById('ordenesPagadas').textContent = summary.ordenesPagadas || 0;
            document.getElementById('promedioPorOrden').textContent = (summary.promedioPorOrden || 0).toFixed(2);
            if (summary.topPlato) document.getElementById('platoTop').textContent = summary.topPlato;
            // KPI cards
            document.getElementById('k_totalVentas').textContent = '$' + (summary.totalFinal || 0).toFixed(2);
            document.getElementById('k_totalIva').textContent = '$' + (summary.totalIva || 0).toFixed(2);
            document.getElementById('k_totalServicio').textContent = '$' + (summary.totalServicio || 0).toFixed(2);
            document.getElementById('k_ordenesTotales').textContent = summary.ordenesTotales || 0;
            document.getElementById('k_ordenesPagadas').textContent = summary.ordenesPagadas || 0;
            document.getElementById('k_promedio').textContent = '$' + (summary.promedioPorOrden || 0).toFixed(2);
        } catch (err) { console.warn('summary failed', err); }

        // hourly
        try {
            const hours = await apiFetch(`/ordenes/estadisticas/hourly?from=${from}`);
            const hlabels = hours.map(h => h.hour);
            const hdata = hours.map(h => h.total);
            const hctx = document.getElementById('hourlyChart');
            if (hourlyChart) hourlyChart.destroy();
            hourlyChart = new Chart(hctx.getContext ? hctx.getContext('2d') : hctx, { type: 'bar', data: { labels: hlabels, datasets: [{ label: 'Ventas', data: hdata, backgroundColor: '#2196f3' }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
        } catch (err) { console.warn('hourly failed', err); }

        // categories
        try {
            const cats = await apiFetch(`/ordenes/estadisticas/categories?from=${from}`);
            const clabels = cats.map(c => c.categoria);
            const cdata = cats.map(c => c.total);
            const cctx = document.getElementById('categoriesChart');
            if (categoriesChart) categoriesChart.destroy();
            categoriesChart = new Chart(cctx.getContext ? cctx.getContext('2d') : cctx, { type: 'doughnut', data: { labels: clabels, datasets: [{ data: cdata, backgroundColor: ['#f44336', '#ff9800', '#ffc107', '#8bc34a', '#00bcd4', '#9c27b0'] }] }, options: { responsive: true } });
        } catch (err) { console.warn('categories failed', err); }

        // top dishes
        try {
            const topResp = await apiFetch(`/ordenes/estadisticas/top-dishes?limit=10&from=${from}`);
            // soportar varias formas: array directamente o { top: [...] }
            const top = Array.isArray(topResp) ? topResp : (topResp.top || topResp);
            const tb = document.querySelector('#tablaTopDishes tbody');
            tb.innerHTML = '';
            top.forEach(row => {
                const name = row.plato || row.name || row.nombre || row[0];
                const qty = row.cantidad || row.count || row.cantidad || row[1] || 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${name}</td><td class="num">${qty}</td>`;
                tb.appendChild(tr);
            });
            if (top.length > 0) {
                const first = top[0];
                const name = first.plato || first.name || first.nombre;
                if (name) document.getElementById('platoTop').textContent = name;
            }
        } catch (err) { console.warn('top failed', err); }

    } catch (error) {
        console.error("Error cargando estadísticas:", error);
    }
}

filtro.addEventListener("change", e => cargarEstadisticas(e.target.value));

cargarEstadisticas(); // inicial
