const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  getPendingPlayers,
  validatePlayer,
} = require("../controllers/players.controller");

// LISTAR JUGADORES PENDIENTES DE VALIDACIÓN
router.get(
  "/pending-players",
  authMiddleware,
  requireRole("admin_club"),
  getPendingPlayers
);

// VALIDAR / RECHAZAR JUGADOR
router.patch(
  "/:playerId/validate-player",
  authMiddleware,
  requireRole("admin_club"),
  validatePlayer
);

// COMPLETAR PERFIL JUGADOR
router.post(
  "/complete-profile",
  authMiddleware,
  requireRole("admin_club"),
  completePlayerProfile
);

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
  requireRole(["profesor", "admin_club"]),
  getPlayers
);

// Rutas dinámicas (con :id) al final
// OBTENER JUGADOR POR ID
router.get(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
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
