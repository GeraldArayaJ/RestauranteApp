import express from "express";
import { getPagosOrden } from "../controllers/pagoOrdenController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Listar todos los pagos de órdenes (solo admin)
router.get("/", authMiddleware(["admin"]), getPagosOrden);

export default router;
