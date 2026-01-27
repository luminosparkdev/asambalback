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
  validatePlayer,
  updateMyPlayerProfile,
} = require("../controllers/players.controller");

// ==========================
// RUTAS ESPECIALES
// ==========================

// COMPLETAR PERFIL JUGADOR
router.post(
  "/:playerId/complete-profile",
  completePlayerProfile
);

// VALIDAR / RECHAZAR JUGADOR (solo profesor)
router.patch(
  "/:id/validate-player",
  authMiddleware,
  requireRole("profesor"),
  validatePlayer
);

// ==========================
// CRUD PRINCIPAL
// ==========================

// CREAR JUGADOR (profesor o admin_club)
router.post(
  "/create",
  authMiddleware,
  requireRole("profesor", "admin_club"),
  createPlayer
);

// LISTAR TODOS LOS JUGADORES DEL CLUB (admin_club)
router.get(
  "/",
  authMiddleware,
  requireRole("admin_club"),
  getPlayers
);

// OBTENER PERFIL PROPIO (jugador)
router.get(
  "/me",
  authMiddleware,
  requireRole("jugador"),
  getMyPlayerProfile
);

// EDITAR PERFIL PROPIO (jugador)
router.put(
  "/me",
  authMiddleware,
  requireRole("jugador"),
  updateMyPlayerProfile
);

// LISTAR JUGADORES DEL PROFESOR
router.get(
  "/by-coach",
  authMiddleware,
  requireRole("profesor"),
  getPlayersByCoach
);

// OBTENER JUGADOR POR ID
router.get(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club", "jugador"]),
  getPlayerById
);

// EDITAR JUGADOR (profesor o admin_club)
router.put(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  updatePlayer
);

// ACTIVAR / DESACTIVAR JUGADOR (profesor o admin_club)
router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  togglePlayerStatus
);

module.exports = router;
