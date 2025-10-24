// ==========================
// Editar orden (admin)
export const updateOrden = async (req, res) => {
    const { id } = req.params;
    const { items, mesaId } = req.body; // items: [{ platoId, cantidad, detalles }], mesaId opcional
    try {
        // Verificar existencia de la orden
        const orden = await prisma.orden.findUnique({
            where: { id: parseInt(id) },
            include: { items: true }
        });
        if (!orden) return res.status(404).json({ message: "Orden no encontrada" });

        // Eliminar todos los items actuales y agregar los nuevos
        // Para eliminar solo la cantidad seleccionada, procesar cada item
        // items: [{ platoId, cantidad, detalles }]
        // Agrupar por platoId y detalles para manejar cantidades

        // Eliminar todos los items existentes
        await prisma.ordenItem.deleteMany({ where: { ordenId: orden.id } });

        // Crear los nuevos items
        let total = 0;
        for (const item of items) {
            const plato = await prisma.plato.findUnique({ where: { id: item.platoId } });
            if (!plato) return res.status(404).json({ message: `Plato ${item.platoId} no encontrado` });
            total += plato.precio * item.cantidad;
            await prisma.ordenItem.create({
                data: {
                    ordenId: orden.id,
                    platoId: item.platoId,
                    cantidad: item.cantidad,
                    detalles: item.detalles || null
                }
            });
        }

        // Actualizar el total y la mesa de la orden
        const updateData = { total };
        if (typeof mesaId !== 'undefined') {
            updateData.mesaId = mesaId ? parseInt(mesaId) : null;
        }
        const updatedOrden = await prisma.orden.update({
            where: { id: orden.id },
            data: updateData,
            include: { items: { include: { plato: true } }, usuario: true, mesa: true },
        });

        // Emitir evento de orden editada
        if (req.io && req.io.emit) {
            req.io.emit("ordenEditada", updatedOrden);
        }

        res.json(updatedOrden);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ==========================
// Crear orden (salonero)
export const createOrden = async (req, res) => {
    const { items } = req.body; // items: [{ platoId, cantidad }]
    const usuarioId = req.user.id;

    try {
        let total = 0;
        for (const item of items) {
            const plato = await prisma.plato.findUnique({ where: { id: item.platoId } });
            if (!plato) return res.status(404).json({ message: `Plato ${item.platoId} no encontrado` });
            total += plato.precio * item.cantidad;
        }

        const mesaId = req.body.mesaId ? parseInt(req.body.mesaId) : null;
        const orden = await prisma.orden.create({
            data: {
                usuarioId,
                total,
                mesaId,
                items: { create: items.map(i => ({ platoId: i.platoId, cantidad: i.cantidad, detalles: i.detalles || null })) },
            },
            include: { items: { include: { plato: true } }, usuario: true, mesa: true },
        });

        // Emitir orden a todos los clientes conectados via Socket.io
        req.io.emit("nuevaOrden", orden);

        res.status(201).json(orden);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================
// Listar órdenes (admin ve todas, salonero solo las propias)
export const getOrdenes = async (req, res) => {
    const rol = req.user.rol;
    const usuarioId = req.user.id;

    try {
        // salonero solo ve sus órdenes, admin y recepcionista ven todas
        const ordenes = await prisma.orden.findMany({
            where: rol === "salonero" ? { usuarioId } : {},
            include: { items: { include: { plato: true } }, usuario: true, mesa: true },
            orderBy: { fecha: "desc" }
        });
        res.json(ordenes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================
// Cambiar estado a entregada (solo admin)
export const entregarOrden = async (req, res) => {
    const { id } = req.params;
    try {
        // Comprobar estado actual
        const existing = await prisma.orden.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return res.status(404).json({ message: 'Orden no encontrada' });
        if (existing.estado === 'entregada' || existing.estado === 'pagada') {
            return res.status(400).json({ message: `Orden ya está en estado '${existing.estado}'` });
        }

        const orden = await prisma.orden.update({
            where: { id: parseInt(id) },
            data: { estado: "entregada" },
            include: { items: { include: { plato: true } }, usuario: true },
        });
        console.log('[state-debug] Orden', orden.id, 'cambiada a entregada (prev estado=', existing.estado, ')');
        // Emitir a todos los clientes que la orden fue entregada
        try {
            console.log('[emit-debug] Emitting ordenEntregada for orden id=', orden.id);
            if (req.io && req.io.emit) {
                req.io.emit('ordenEntregada', orden);
                console.log('[emit-debug] Emitted ordenEntregada successfully');
            } else {
                console.warn('[emit-debug] req.io not available - cannot emit ordenEntregada');
            }
        } catch (e) {
            console.warn('[emit-debug] Emit failed', e);
        }
        res.json({ message: "Orden entregada", orden });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================
// Pagar orden (solo admin)
export const pagarOrden = async (req, res) => {
    const { id } = req.params;
    const { tipoPago } = req.body;

    try {
        const existing = await prisma.orden.findUnique({ where: { id: parseInt(id) }, include: { items: { include: { plato: true } }, mesa: true } });
        if (!existing) return res.status(404).json({ message: 'Orden no encontrada' });
        // Permitir pagar si está entregada o si el total es 0 (pagos divididos)
        if (existing.estado !== 'entregada' && !(existing.total === 0 && existing.items.length === 0)) {
            return res.status(400).json({ message: `Sólo se puede pagar una orden entregada o vacía. Estado actual: ${existing.estado}` });
        }

        // Calcular subtotal, IVA y servicio para toda la orden
        let subtotal = 0;
        for (const item of existing.items) {
            subtotal += item.plato.precio * item.cantidad;
        }
        subtotal = Math.round(subtotal * 100) / 100;
        const iva = Math.round(subtotal * 0.13 * 100) / 100;
        // Si la orden es para llevar (sin mesaId), no se aplica servicio
        const servicio = existing.mesaId ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
        const montoFinal = Math.round((subtotal + iva + servicio) * 100) / 100;

        // Registrar el pago en PagoOrden
        await prisma.pagoOrden.create({
            data: {
                ordenId: existing.id,
                monto: montoFinal,
                tipoPago,
            }
        });
        const orden = await prisma.orden.update({
            where: { id: parseInt(id) },
            data: { estado: "pagada", tipoPago, iva, servicio, montoFinal },
            include: { items: { include: { plato: true } }, usuario: true, mesa: true },
        });
        console.log('[state-debug] Orden', orden.id, 'cambiada a pagada (tipoPago=', tipoPago, ')');
        // Emitir evento por socket para actualizar mesas en tiempo real
        if (req.io && req.io.emit) {
            req.io.emit('ordenPagada', orden);
        }
        res.json({ message: "Orden pagada", orden, subtotal, iva, servicio, montoFinal });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================
// Estadísticas de ventas
export const estadisticas = async (req, res) => {
    const { periodo = 'dia', from } = req.query;
    try {
        // Determinar fecha de inicio según query 'from' o periodo
        let fromDate;
        if (from) {
            // esperar formato YYYY-MM-DD
            const parts = from.split('-');
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                fromDate = new Date(y, m, d);
            } else {
                fromDate = new Date(0);
            }
        } else {
            const now = new Date();
            if (periodo === 'dia') {
                fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (periodo === 'quincena') {
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - 14);
                fromDate.setHours(0, 0, 0, 0);
            } else if (periodo === 'mes') {
                fromDate = new Date(now);
                fromDate.setDate(now.getDate() - 29);
                fromDate.setHours(0, 0, 0, 0);
            } else {
                fromDate = new Date(0);
            }
        }

        // Traer órdenes desde fromDate. Sólo contar órdenes pagadas como ventas reales
        // Consider an order as paid if its estado is 'pagada' OR it has tipoPago set
        const ordenes = await prisma.orden.findMany({
            where: {
                fecha: { gte: fromDate },
                OR: [
                    { estado: 'pagada' },
                    { tipoPago: { not: null } }
                ]
            },
            include: { items: { include: { plato: true } } },
            orderBy: { fecha: 'asc' }
        });

        // Agregar totales por fecha (día)
        const mapa = new Map();
        let totalVentas = 0;
        const platoContador = {};

        // helper para formatear fecha local YYYY-MM-DD
        const fmtLocal = (d) => {
            const yy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        };

        let totalIva = 0, totalServicio = 0, totalFinal = 0;
        for (const o of ordenes) {
            const dt = new Date(o.fecha);
            const fechaKey = fmtLocal(dt);
            mapa.set(fechaKey, (mapa.get(fechaKey) || 0) + (o.montoFinal || 0));
            totalVentas += o.montoFinal || 0;
            totalIva += o.iva || 0;
            totalServicio += o.servicio || 0;
            totalFinal += o.montoFinal || 0;
            for (const it of o.items) {
                const nombre = it.plato?.nombre || 'Desconocido';
                platoContador[nombre] = (platoContador[nombre] || 0) + it.cantidad;
            }
        }

        // Construir lista de fechas desde fromDate hasta hoy e inicializar a 0
        const fechas = [];
        const totales = [];
        const start = new Date(fromDate);
        const end = new Date();
        // normalizar horas
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const key = fmtLocal(d);
            fechas.push(key);
            totales.push(Number((mapa.get(key) || 0)));
        }

        // Plato top
        const platoTop = Object.keys(platoContador).length ? Object.entries(platoContador).sort((a, b) => b[1] - a[1])[0][0] : null;

        res.json({ totalVentas, totalIva, totalServicio, totalFinal, platoTop, fechas, totales });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Resumen KPI: total ventas, órdenes totales, órdenes pagadas, promedio por orden
export const estadisticasSummary = async (req, res) => {
    const { periodo = 'dia', from } = req.query;
    try {
        let fromDate;
        if (from) {
            const parts = from.split('-');
            if (parts.length === 3) fromDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            else fromDate = new Date(0);
        } else {
            const now = new Date();
            if (periodo === 'dia') fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            else if (periodo === 'quincena') { fromDate = new Date(now); fromDate.setDate(now.getDate() - 14); fromDate.setHours(0, 0, 0, 0); }
            else if (periodo === 'mes') { fromDate = new Date(now); fromDate.setDate(now.getDate() - 29); fromDate.setHours(0, 0, 0, 0); }
            else fromDate = new Date(0);
        }

        const ordenes = await prisma.orden.findMany({ where: { fecha: { gte: fromDate } } });
        // Treat as paid if estado === 'pagada' OR tipoPago is non-null/non-empty
        const ordenesPagadas = ordenes.filter(o => o.estado === 'pagada' || (o.tipoPago && o.tipoPago !== ''));
        const totalVentas = ordenesPagadas.reduce((s, o) => s + (o.total || 0), 0);
        const totalIva = ordenesPagadas.reduce((s, o) => s + (o.iva || 0), 0);
        const totalServicio = ordenesPagadas.reduce((s, o) => s + (o.servicio || 0), 0);
        const totalFinal = ordenesPagadas.reduce((s, o) => s + (o.montoFinal || 0), 0);
        const promedio = ordenesPagadas.length ? totalVentas / ordenesPagadas.length : 0;

        res.json({ totalVentas, totalIva, totalServicio, totalFinal, ordenesTotales: ordenes.length, ordenesPagadas: ordenesPagadas.length, promedioPorOrden: promedio });
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Horario: ventas por hora del día actual (0-23)
export const estadisticasHourly = async (req, res) => {
    try {
        const { from } = req.query;
        let start;
        if (from) {
            const parts = from.split('-');
            const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
            start = new Date(y, m, d);
        } else {
            const today = new Date();
            start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        }
        const ordenes = await prisma.orden.findMany({ where: { fecha: { gte: start }, OR: [{ estado: 'pagada' }, { tipoPago: { not: null } }] } });
        const hours = Array.from({ length: 24 }, () => 0);
        ordenes.forEach(o => { const h = new Date(o.fecha).getHours(); hours[h] += o.total || 0; });
        // devolver array de objetos para facilitar consumo
        res.json(hours.map((t, i) => ({ hour: i, total: t })));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Categorías: totales por categoría
export const estadisticasCategories = async (req, res) => {
    try {
        const { from } = req.query;
        // treat as paid when estado is 'pagada' OR tipoPago is set
        let where = { OR: [{ estado: 'pagada' }, { tipoPago: { not: null } }] };
        if (from) {
            const parts = from.split('-');
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
                where.fecha = { gte: new Date(y, m, d) };
            }
        }
        const all = await prisma.orden.findMany({ where, include: { items: { include: { plato: true } } } });
        const byCat = {};
        all.forEach(o => {
            o.items.forEach(it => {
                const cat = it.plato?.categoria || 'Otros';
                byCat[cat] = (byCat[cat] || 0) + (it.plato?.precio || 0) * (it.cantidad || 1);
            });
        });
        // devolver array de {categoria,total}
        res.json(Object.entries(byCat).map(([categoria, total]) => ({ categoria, total })));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// Top dishes by quantity
export const estadisticasTopDishes = async (req, res) => {
    try {
        const { from, limit = 10 } = req.query;
        // treat as paid when estado is 'pagada' OR tipoPago is set
        let where = { OR: [{ estado: 'pagada' }, { tipoPago: { not: null } }] };
        if (from) {
            const parts = from.split('-');
            if (parts.length === 3) { const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10); where.fecha = { gte: new Date(y, m, d) }; }
        }
        const all = await prisma.orden.findMany({ where, include: { items: { include: { plato: true } } } });
        const counts = {};
        all.forEach(o => o.items.forEach(it => { const name = it.plato?.nombre || 'Desconocido'; counts[name] = (counts[name] || 0) + (it.cantidad || 0); }));
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        res.json(sorted.slice(0, Number(limit)).map(([name, count]) => ({ plato: name, cantidad: count })));
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ==========================
// Registrar pago parcial en PagoOrden
export const registrarPagoParcial = async (req, res) => {
    const { id } = req.params;
    const { tipoPago, platos } = req.body;
    try {
        // Verificar existencia de la orden
        const orden = await prisma.orden.findUnique({ where: { id: parseInt(id) }, include: { pagos: true } });
        if (!orden) return res.status(404).json({ message: "Orden no encontrada" });
        // Calcular subtotal según platos seleccionados
        let subtotal = 0;
        for (const p of platos) {
            const plato = await prisma.plato.findUnique({ where: { id: p.platoId } });
            if (!plato) return res.status(404).json({ message: `Plato ${p.platoId} no encontrado` });
            subtotal += plato.precio * p.cantidad;
        }
        subtotal = Math.round(subtotal * 100) / 100;
        const iva = Math.round(subtotal * 0.13 * 100) / 100;
        const servicio = Math.round(subtotal * 0.10 * 100) / 100;
        const montoFinal = Math.round((subtotal + iva + servicio) * 100) / 100;
        // Registrar pago parcial
        const pago = await prisma.pagoOrden.create({
            data: {
                ordenId: orden.id,
                monto: montoFinal,
                tipoPago,
            }
        });
        // Actualizar campos acumulados en la orden
        // Sumar todos los pagos
        const pagos = await prisma.pagoOrden.findMany({ where: { ordenId: orden.id } });
        const totalPagado = pagos.reduce((s, p) => s + p.monto, 0);
        // Guardar tipos de pago únicos
        const tipos = [...new Set(pagos.map(p => p.tipoPago))].join(', ');
        // Si la suma de pagos cubre el total de la orden, marcar como pagada y guardar tipos
        let estado = orden.estado;
        if (totalPagado >= orden.total) {
            estado = 'pagada';
        }
        await prisma.orden.update({
            where: { id: orden.id },
            data: {
                iva,
                servicio,
                montoFinal,
                tipoPago: tipos,
                estado
            }
        });
        res.json({ message: "Pago parcial registrado", pago, subtotal, iva, servicio, montoFinal, totalPagado, tipos, estado });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
