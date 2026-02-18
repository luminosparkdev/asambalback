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
  createMembresia,
  getSeguroYears,
  getSegurosByYear,
  createSeguro,
  getAllTicketsEmpadronamiento,
  pagarEmpadronamientoMasivo,
  createEmpadronamientoClub,
  seedLosToldos
} = require("../controllers/asambal.controller");

const { createClubWithAdmin } = require("../controllers/clubs.controller");

const {getMyTransferRequests} = require("../controllers/players.controller");

router.post(
  "/dev/seed-los-toldos",
  seedLosToldos
);


/*---------------------------------------------------
------------------PERFIL ASAMBAL---------------------
---------------------------------------------------*/
// OBTENER PERFIL ASAMBAL
router.get("/me",
  authMiddleware,
  requireRole("admin_asambal"),
  getMyAsambalProfile
);
// ACTUALIZAR PERFIL ASAMBAL
router.put("/me",
  authMiddleware,
  requireRole("admin_asambal"),
  updateMyAsambalProfile
);

/*---------------------------------------------------
------------------GESTION INSTITUCIONAL--------------
---------------------------------------------------*/
// OBTENER USUARIOS PENDIENTES DE VALIDACION
router.get(
  "/pending-users",
  authMiddleware,
  requireRole("admin_asambal"),
  getPendingUsers
);
// VALIDAR USUARIO PENDIENTE
router.patch(
  "/validate-user",
  authMiddleware,
  requireRole("admin_asambal"),
  validateUser
);
// OBTENER SOLICITUDES DE TRANSFERENCIA PENDIENTES
router.get(
  "/transfers",
  authMiddleware,
  requireRole("admin_club", "admin_asambal"),
  getMyTransferRequests
);

// CREAR CLUB CON USUARIO ADMIN ASAMBAL
router.post(
  "/clubs",
  authMiddleware,
  requireRole("admin_asambal"),
  createClubWithAdmin
);

// OBTENER TODOS LOS JUGADORES
router.get(
  "/players",
  authMiddleware,
  requireRole("admin_asambal"),
  getAllPlayersAsambal
);
// OBTENER DETALLE DE JUGADOR
router.get(
  "/players/:id",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayerDetailAsambal
);

//BECAS
// OBTENER JUGADORES CON BECA ACTIVA
router.get(
  "/players-with-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayersWithScholarship
);
// OBTENER HISTORIAL DE BECAS DE UN JUGADOR
router.get(
  "/players/:id/scholarships",
  authMiddleware,
  requireRole("admin_asambal"),
  getPlayerScholarshipHistory
);
// OTORGAR BECA A JUGADOR
router.post(
  "/players/:id/grant-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  grantScholarship
);
// REVOCAR BECA DE JUGADOR
router.post(
  "/becas/:becaId/revoke-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  revokeScholarship
);

// EMPADRONAMIENTOS
// CREAR EMPADRONAMIENTO JUGADORES
router.post(
  "/empadronamiento",
  authMiddleware,
  requireRole("admin_asambal"),
  createEmpadronamiento
);
// CREAR EMPADRONAMIENTO CLUB LOS TOLDOS
router.post(
  "/empadronamiento/club",
  authMiddleware,
  requireRole("admin_asambal"),
  createEmpadronamientoClub
);
// PAGAR EMPADRONAMIENTO MASIVO
router.put(
  "/empadronamiento/pagar-masivo",
  authMiddleware,
  requireRole("admin_asambal"),
  pagarEmpadronamientoMasivo
);
// OBTENER TODOS LOS TICKETS DE EMPADRONAMIENTO
router.get(
  "/empadronamiento/tickets",
  authMiddleware,
  requireRole("admin_asambal"),
  getAllTicketsEmpadronamiento
);

//MEMBRESIAS
// CREAR MEMBRESIA
router.post(
  "/membresia",
  authMiddleware,
  requireRole("admin_asambal"),
  createMembresia
);

//SEGUROS

// OBTENER AÑOS CON SEGUROS REGISTRADOS
router.get(
  "/seguros/years",
  authMiddleware,
  requireRole("admin_asambal"),
  getSeguroYears
);

// OBTENER SEGUROS POR AÑO
router.get(
  "/seguros",
  authMiddleware,
  requireRole("admin_asambal"),
  getSegurosByYear
);

// CREAR SEGURO DE PROFESORES
router.post(
  "/seguros",
  authMiddleware,
  requireRole("admin_asambal"),
  createSeguro
);

//PROFESORES
// OBTENER TODOS LOS PROFESORES
router.get(
  "/coaches",
  authMiddleware,
  requireRole("admin_asambal"),
  getAllCoachesAsambal
);
// OBTENER DETALLE DE PROFESOR
router.get(
  "/coaches/:id",
  authMiddleware,
  requireRole("admin_asambal"),
  getCoachDetailAsambal
);

module.exports = router;