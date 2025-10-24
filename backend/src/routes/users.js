
import express from "express";
import { registerUser, loginUser, createUserAdmin, listUsers, updateUserAdmin, deleteUserAdmin, getMeUser, activarUsuario } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();
// Activar usuario desactivado
router.put('/:id/activar', authMiddleware(["admin"]), activarUsuario);
// Obtener usuario autenticado
router.get('/me', authMiddleware(), getMeUser);

// Registro y login
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout exitoso' });
});

// Admin-only: create user (hashing is handled in controller)
router.post("/", authMiddleware(["admin"]), createUserAdmin);
router.get("/", authMiddleware(["admin"]), listUsers);
router.put("/:id", authMiddleware(["admin"]), updateUserAdmin);
router.delete("/:id", authMiddleware(["admin"]), deleteUserAdmin);

export default router;