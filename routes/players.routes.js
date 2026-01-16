const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createPlayer,
  getPlayers,
  getPlayersByCoach,
  getMyPlayerProfile,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  getPendingPlayers,
  validatePlayer,
  updateMyPlayerProfile,
} = require("../controllers/players.controller");

// ==========================
// RUTAS ESPECIALES
// ==========================

// LISTAR JUGADORES PENDIENTES DE VALIDACIÓN
router.get(
  "/pending-players",
  authMiddleware,
  requireRole(["profesor"]),
  getPendingPlayers
);

// VALIDAR / RECHAZAR JUGADOR
router.patch(
  "/:id/validate-player",
  authMiddleware,
  requireRole(["profesor"]),
  validatePlayer
);

// COMPLETAR PERFIL JUGADOR
router.post(
  "/complete-profile",
  authMiddleware,
  requireRole(["jugador"]),
  completePlayerProfile
);

// ==========================
// CRUD PRINCIPAL
// ==========================

// CREAR JUGADOR
router.post(
  "/",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  createPlayer
);

// LISTAR JUGADORES DEL CLUB
router.get(
  "/",
  authMiddleware,
  requireRole(["admin_club"]),
  getPlayers
);

router.get(
  "/me",
  authMiddleware,
  requireRole(["jugador"]),
  getMyPlayerProfile
);

router.put(
  "/me",
  authMiddleware,
  requireRole(["jugador"]),
  updateMyPlayerProfile
);
// LISTAR JUGADORES DEL PROFESOR
router.get(
  "/players-by-coach",
  authMiddleware,
  requireRole(["profesor"]),
  getPlayersByCoach
);

// OBTENER JUGADOR POR ID
router.get(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club", "jugador"]),
  getPlayerById
);

// EDITAR JUGADOR
router.put(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  updatePlayer
);

// ACTIVAR / DESACTIVAR JUGADOR
router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  togglePlayerStatus
);

module.exports = router;
