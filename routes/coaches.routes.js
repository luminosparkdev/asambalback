const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createProfesor,
  requestJoinCoach,
  getMyCoachRequests,
  respondCoachRequest,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
  completeProfesorProfile,
  getPendingCoaches,
  validateCoach,
  getMyCoachProfile,
  updateMyCoachProfile,
  validatePlayersInClub,
} = require("../controllers/coaches.controller");

// =======================
// CREACIÓN
// =======================
router.post(
  "/create",
  authMiddleware,
  requireRole("admin_club"),
  createProfesor
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
  "/me/complete-profile",
  authMiddleware,
  requireRole("profesor"),
  completeProfesorProfile
);

// =======================
// SOLICITUDES
// =======================
router.post(
  "/join-club",
  authMiddleware,
  requireRole("profesor"),
  requestJoinCoach
);

router.get(
  "/my-requests",
  authMiddleware,
  requireRole("profesor"),
  getMyCoachRequests
);

router.patch(
  "/requests/:id/respond",
  authMiddleware,
  requireRole("admin_club"),
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
  "/club/pending",
  authMiddleware,
  requireRole("admin_club"),
  getPendingCoaches
);

router.get(
  "/:id",
  authMiddleware,
  requireRole(["admin_club", "profesor"]),
  getProfesorById
);

// =======================
// EDITAR / TOGGLE
// =======================
router.put(
  "/:id",
  authMiddleware,
  requireRole("admin_club"),
  updateProfesor
);

router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole("admin_club"),
  toggleProfesorStatus
);

// =======================
// VALIDAR JUGADORES
// =======================
router.patch(
  "/validate-player",
  authMiddleware,
  requireRole("profesor"),
  validatePlayersInClub
);

module.exports = router;
