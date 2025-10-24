
import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
	getOrdenes,
	createOrden,
	entregarOrden,
	pagarOrden,
	estadisticas,
	estadisticasSummary,
	estadisticasHourly,
	estadisticasCategories,
	estadisticasTopDishes,
	updateOrden,
	registrarPagoParcial
} from "../controllers/ordenController.js";

const router = express.Router();

// Registrar pago parcial (admin, recepcionista)
router.post("/:id/pago-parcial", authMiddleware(["admin", "recepcionista"]), registrarPagoParcial);

// Obtener órdenes
router.get("/", authMiddleware(["admin", "salonero", "recepcionista"]), getOrdenes);

// Estadísticas de ventas
router.get("/estadisticas", authMiddleware(["admin"]), estadisticas);
router.get("/estadisticas/summary", authMiddleware(["admin"]), estadisticasSummary);
router.get("/estadisticas/hourly", authMiddleware(["admin"]), estadisticasHourly);
router.get("/estadisticas/categories", authMiddleware(["admin"]), estadisticasCategories);
router.get("/estadisticas/top-dishes", authMiddleware(["admin"]), estadisticasTopDishes);

// Crear orden (salonero)
router.post("/", authMiddleware(["admin", "recepcionista", "salonero"]), createOrden);

// Cambiar estado a entregada (admin)
router.post("/:id/entregar", authMiddleware(["admin", "recepcionista"]), entregarOrden);

// Pagar orden (admin) y liberar la mesa
router.post("/:id/pagar", authMiddleware(["admin", "recepcionista"]), pagarOrden);

// Editar orden (admin)
router.put("/:id", authMiddleware(["admin", "recepcionista"]), updateOrden);

export default router;
