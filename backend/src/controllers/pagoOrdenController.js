import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Listar todos los pagos de órdenes
export const getPagosOrden = async (req, res) => {
    try {
        // Solo admin puede ver todos los pagos
        const pagos = await prisma.pagoOrden.findMany({
            include: {
                orden: {
                    select: { id: true, usuarioId: true, mesaId: true, total: true, estado: true, fecha: true }
                }
            },
            orderBy: { fecha: "desc" }
        });
        res.json(pagos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
