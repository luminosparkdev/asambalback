const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const { createUser } = require("../controllers/users.controller");
const {
  getPendingCoach,
  validateRoleInClub,
  getClubs,
  toggleClubStatus,
  getClubById,
  updateClub,
  completeClubProfile,
  getMyClubProfile,
  updateMyClub,
  getPlayersByClub
} = require("../controllers/clubs.controller");
const { sendRequestJoinToCoach } = require("../controllers/coaches.controller");

// -------------------- CREACIÓN DE USUARIOS --------------------

// Crear profesor (admin_club)
router.post("/create-professor",
  authMiddleware,
  requireRole("admin_club"),
  (req, res) => {
    req.body.role = "profesor";
    createUser(req, res);
  });

// Enviar solicitud de unirse a un club (jugador)
router.post("/request-coach",
  authMiddleware,
  requireRole("admin_club"),
  sendRequestJoinToCoach);

// Crear jugador (admin_club)
router.post("/create-player",
  authMiddleware,
  requireRole("admin_club"),
  (req, res) => {
    req.body.role = "jugador";
    createUser(req, res);
  });

// LISTAR TODOS LOS JUGADORES DEL CLUB (admin_club)
router.get(
  "/players-by-club",
  authMiddleware,
  //requireRole("admin_club"),
  getPlayersByClub
);

// -------------------- PERFIL Y COMPLETAR PERFIL --------------------

// Completar perfil club (admin_club)
router.post("/:clubId/complete-profile",
  completeClubProfile
);

// Perfil propio
router.get("/me", authMiddleware, requireRole("admin_club"), getMyClubProfile);
router.put("/me", authMiddleware, requireRole("admin_club"), updateMyClub);

// -------------------- SOLICITUDES PENDIENTES --------------------

// Obtener solicitudes pendientes de profesores (admin_club)
router.get("/pending-coaches", authMiddleware, requireRole("admin_club"), getPendingCoach);

// Aprobar o rechazar usuario profesor
router.patch("/:id/validate-coach", authMiddleware, requireRole("admin_club"), validateRoleInClub);

// -------------------- CRUD CLUBES (ADMIN_ASAMBAL) --------------------

// Listar todos los clubes
router.get("/", authMiddleware, requireRole("admin_asambal"), getClubs);

// Obtener club por ID (admin_asambal o admin_club)
router.get("/:id", authMiddleware, requireRole("admin_asambal", "admin_club"), getClubById);

// Actualizar club (solo admin_asambal)
router.put("/:id", authMiddleware, requireRole("admin_asambal"), updateClub);

// Cambiar estado ACTIVO/INACTIVO (solo admin_asambal)
router.patch("/:id/toggle", authMiddleware, requireRole("admin_asambal"), toggleClubStatus);

module.exports = router;