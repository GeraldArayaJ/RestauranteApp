import express from "express";
import {
    getPlatos,
    createPlato,
    updatePlato,
    deletePlato,
} from "../controllers/platoController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Rutas públicas
router.get("/", getPlatos);

// Rutas solo admin
router.post("/", authMiddleware(["admin"]), createPlato);
router.put("/:id", authMiddleware(["admin"]), updatePlato);
router.delete("/:id", authMiddleware(["admin"]), deletePlato);

export default router;
