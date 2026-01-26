const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const resolveActiveClub = require("../middlewares/activeClub.middleware");

const {
  createProfesor,
  getMyClubs,
  getPendingPlayers,
  getMyCoachRequests,
  respondCoachRequest,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
  completeProfesorProfile,
  getCoachPrefillByToken,
  validateCoach,
  getMyCoachProfile,
  updateMyCoachProfile,
  validatePlayersInClub,
} = require("../controllers/coaches.controller.js");

// =======================
// CREACIÓN
// =======================
router.post(
  "/create",
  authMiddleware,
  requireRole("admin_club"),
  createProfesor
);

router.get(
  "/my-clubs",
  authMiddleware,
  requireRole("profesor"),
  getMyClubs
);

router.get(
  "/pending-players/:clubId",
  authMiddleware,
  requireRole("profesor"),
  getPendingPlayers
);

// =======================
// PERFIL PROPIO
// =======================
router.get(
  "/me",
  authMiddleware,
  requireRole("profesor"),
  getMyCoachProfile
);

router.put(
  "/me",
  authMiddleware,
  requireRole("profesor"),
  updateMyCoachProfile
);

router.post(
  "/:coachId/complete-profile",
  completeProfesorProfile
);

router.get("/prefill/:activationToken", getCoachPrefillByToken);

// =======================
// SOLICITUDES
// =======================

router.get(
  "/my-requests",
  authMiddleware,
  requireRole("profesor"),
  getMyCoachRequests
);

router.patch(
  "/requests/:id/respond",
  authMiddleware,
  requireRole("profesor"),
  respondCoachRequest
);

// =======================
// LISTAR / DETALLE
// =======================
router.get(
  "/club",
  authMiddleware,
  requireRole("admin_club"),
  getProfesores
);

router.get(
  "/:id",
  authMiddleware,
  resolveActiveClub,
  requireRole("admin_club", "profesor"),
  getProfesorById
);

// =======================
// EDITAR / TOGGLE
// =======================
router.put(
  "/:id",
  authMiddleware,
  resolveActiveClub,
  requireRole("admin_club"),
  updateProfesor
);

router.patch(
  "/:id/toggle",
  authMiddleware,
  resolveActiveClub,
  requireRole("admin_club"),
  toggleProfesorStatus
);

// =======================
// VALIDAR JUGADORES
// =======================
router.patch(
  "/validate-player",
  authMiddleware,
  resolveActiveClub,
  requireRole("profesor"),
  validatePlayersInClub
);

module.exports = router;
