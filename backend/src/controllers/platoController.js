import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Listar todos los platos
export const getPlatos = async (req, res) => {
    try {
        const platos = await prisma.plato.findMany();
        res.json(platos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Crear plato (solo admin)
export const createPlato = async (req, res) => {
    const { nombre, precio, categoria, estado } = req.body;
    try {
        const plato = await prisma.plato.create({
            data: {
                nombre,
                precio: parseFloat(precio),
                categoria,
                estado: estado || 'disponible',
            },
        });
        res.status(201).json(plato);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Editar plato
export const updatePlato = async (req, res) => {
    const { id } = req.params;
    const { nombre, precio, categoria, estado } = req.body;
    try {
        const plato = await prisma.plato.update({
            where: { id: parseInt(id) },
            data: {
                nombre,
                precio: parseFloat(precio),
                categoria,
                ...(estado ? { estado } : {}),
            },
        });
        res.json(plato);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Eliminar plato
export const deletePlato = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.plato.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Plato eliminado" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
