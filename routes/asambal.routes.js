const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const {
  getPendingUsers,
  validateUser,
  getMyAsambalProfile,
  updateMyAsambalProfile,
  getAllPlayersAsambal,
  getPlayerDetailAsambal,
  getPlayersWithScholarship,
  getPlayerScholarshipHistory,
  grantScholarship,
  revokeScholarship,
  getAllCoachesAsambal,
  getCoachDetailAsambal,
  createEmpadronamiento,
  createMembresia
} = require("../controllers/asambal.controller");
const { createClubWithAdmin } = require("../controllers/clubs.controller");
const {getMyTransferRequests} = require("../controllers/players.controller");

//PERFIL ASAMBAL
router.get("/me",
  authMiddleware,
  requireRole("admin_asambal"),
  getMyAsambalProfile
);
router.put("/me",
  authMiddleware,
  requireRole("admin_asambal"),
  updateMyAsambalProfile
);

//SOLICITUDES PENDIENTES
router.get(
  "/pending-users",
  authMiddleware,
  requireRole("admin_asambal"),
  getPendingUsers
);

router.patch(
  "/validate-user",
  authMiddleware,
  requireRole("admin_asambal"),
  validateUser
);

router.get(
  "/transfers",
  authMiddleware,
  requireRole("admin_club", "admin_asambal"),
  getMyTransferRequests
);

//CLUBES
router.post(
  "/clubs",
  authMiddleware,
  requireRole("admin_asambal"),
  createClubWithAdmin
);

//JUGADORES
router.get(
  "/players",
  authMiddleware,
  requireRole("admin_asambal"),
  getAllPlayersAsambal
);

router.get(
  "/players/:id",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayerDetailAsambal
);

//BECAS

router.get(
  "/players-with-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayersWithScholarship
);

router.get(
  "/players/:id/scholarships",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayerScholarshipHistory
);

router.post(
  "/players/:id/grant-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  grantScholarship
);

router.post(
  "/becas/:becaId/revoke-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  revokeScholarship
);

// EMPADRONAMIENTOS

router.post(
  "/empadronamiento",
  authMiddleware,
  requireRole("admin_asambal"),
  createEmpadronamiento
);

//MEMBRESIAS

router.post(
  "/membresia",
  authMiddleware,
  requireRole("admin_asambal"),
  createMembresia
);
//PROFESORES

router.get(
  "/coaches",
  authMiddleware,
  requireRole("admin_asambal"),
  getAllCoachesAsambal
);

router.get(
  "/coaches/:id",
  authMiddleware,
  requireRole("admin_asambal"),
  getCoachDetailAsambal
);

module.exports = router;