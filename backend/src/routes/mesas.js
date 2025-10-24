import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Listar todas las mesas
// Listar todas las mesas (mantener estado real: libre, ocupado, desactivada)
router.get('/', async (req, res) => {
  // Traer todas las mesas y sus órdenes
  const mesas = await prisma.mesa.findMany({
    include: {
      ordenes: {
        where: { estado: { not: 'pagada' } },
        select: { id: true }
      }
    }
  });
  // Si la mesa está desactivada, mantener estado; si no, calcular ocupado/libre
  const mesasConEstado = mesas.map(m => {
    if (m.estado === 'desactivada') return { ...m };
    return {
      ...m,
      estado: (m.ordenes && m.ordenes.length > 0) ? 'ocupado' : 'libre'
    };
  });
  res.json(mesasConEstado);
});

// Crear una mesa (solo admin)
router.post('/', authMiddleware(['admin']), async (req, res) => {
  const { nombre } = req.body;
  const mesa = await prisma.mesa.create({ data: { nombre } });
  res.json(mesa);
});

// Cambiar estado de una mesa
router.put('/:id/estado', authMiddleware(['admin']), async (req, res) => {
  const { estado } = req.body;
  const mesa = await prisma.mesa.update({
    where: { id: parseInt(req.params.id) },
    data: { estado },
  });
  res.json(mesa);
});

// Editar nombre y estado de la mesa (solo admin)
router.put('/:id', authMiddleware(['admin']), async (req, res) => {
  const { nombre, estado } = req.body;
  const data = {};
  if (nombre) data.nombre = nombre;
  if (estado) data.estado = estado;
  const mesa = await prisma.mesa.update({
    where: { id: parseInt(req.params.id) },
    data
  });
  res.json(mesa);
});

// Eliminar mesa (solo admin)
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  await prisma.mesa.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ ok: true });
});

// Liberar mesa (opcional)
router.put('/:id/liberar', async (req, res) => {
  const mesa = await prisma.mesa.update({
    where: { id: parseInt(req.params.id) },
    data: { estado: 'libre' },
  });
  res.json(mesa);
});

export default router;
