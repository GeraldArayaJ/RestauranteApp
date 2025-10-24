// Activar usuario desactivado (cambiar rol)
export const activarUsuario = async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;
    if (!['admin', 'recepcionista', 'salonero'].includes(rol)) {
        return res.status(400).json({ message: 'Rol no válido' });
    }
    try {
        const user = await prisma.usuario.update({ where: { id: Number(id) }, data: { rol } });
        res.json({ message: 'Usuario activado', user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Devuelve el usuario autenticado (para /api/users/me)
export const getMeUser = async (req, res) => {
    try {
        // req.user viene del authMiddleware (id, rol)
        const user = await prisma.usuario.findUnique({
            where: { id: req.user.id },
            select: { id: true, nombre: true, correo: true, rol: true }
        });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = "tu_secreto_aqui"; // Mejor usar variable de entorno

export const registerUser = async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    try {
        const existingUser = await prisma.usuario.findUnique({ where: { correo } });
        if (existingUser)
            return res.status(400).json({ message: "Usuario ya existe" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.usuario.create({
            data: { nombre, correo, password: hashedPassword, rol },
        });

        res
            .status(201)
            .json({
                message: "Usuario creado",
                user: { id: user.id, nombre, correo, rol },
            });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createUserAdmin = async (req, res) => {
    const { nombre, correo, password, rol } = req.body;
    try {
        const existingUser = await prisma.usuario.findUnique({ where: { correo } });
        if (existingUser)
            return res.status(400).json({ message: "Usuario ya existe" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.usuario.create({ data: { nombre, correo, password: hashedPassword, rol } });

        res.status(201).json({ message: "Usuario creado por admin", user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const listUsers = async (req, res) => {
    try {
        const users = await prisma.usuario.findMany({ select: { id: true, nombre: true, correo: true, rol: true } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateUserAdmin = async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, password, rol } = req.body;
    console.log(`[userController] updateUserAdmin called for id=${id} payload=`, { nombre, correo, rol, hasPassword: !!password });
    try {
        const data = { nombre, correo, rol };
        if (password) data.password = await bcrypt.hash(password, 10);
        const user = await prisma.usuario.update({ where: { id: Number(id) }, data });
        res.json({ message: 'Usuario actualizado', user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteUserAdmin = async (req, res) => {
    const { id } = req.params;
    console.log(`[userController] deleteUserAdmin called for id=${id}`);
    try {
        // Verificar si el usuario tiene órdenes asociadas
        const ordenes = await prisma.orden.findMany({ where: { usuarioId: Number(id) } });
        if (ordenes.length > 0) {
            // Si tiene órdenes, ponerlo como desactivado
            await prisma.usuario.update({ where: { id: Number(id) }, data: { rol: 'desactivado' } });
            return res.json({ message: 'Usuario desactivado porque tiene órdenes asociadas' });
        } else {
            // Si no tiene órdenes, eliminarlo
            await prisma.usuario.delete({ where: { id: Number(id) } });
            return res.json({ message: 'Usuario eliminado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const loginUser = async (req, res) => {
    const { correo, password } = req.body;
    console.log('=== LOGIN DEBUG ===');
    console.log('Login attempt for:', correo);
    console.log('Origin:', req.headers.origin);
    console.log('User-Agent:', req.headers['user-agent']);
    
    try {
        const user = await prisma.usuario.findUnique({ where: { correo } });
        if (!user)
            return res.status(400).json({ message: "Usuario no encontrado" });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword)
            return res.status(401).json({ message: "Contraseña incorrecta" });

        const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, {
            expiresIn: "8d",
        });
        
        console.log('Token generado:', token.substring(0, 20) + '...');
        
        // Enviar el token como cookie httpOnly y secure  
        // Para desarrollo local, configuración compatible con ambos navegadores
        const cookieOptions = {
            httpOnly: false, // Temporalmente false para debug
            secure: false, // Solo HTTPS en producción
            sameSite: 'Lax', // Lax para desarrollo local
            maxAge: 8 * 24 * 60 * 60 * 1000, // 8 días
            path: '/' // Asegurar que la cookie esté disponible en todo el dominio
        };

        // No especificar domain para que funcione en ambos localhost y 127.0.0.1
        res.cookie('token', token, cookieOptions);
        
        console.log('Cookie configurada exitosamente');
        console.log('==================');
        
        res.json({
            message: "Login exitoso",
            user: { id: user.id, nombre: user.nombre, rol: user.rol },
        });
    } catch (error) {
        console.log('Error en login:', error);
        res.status(500).json({ message: error.message });
    }
};
