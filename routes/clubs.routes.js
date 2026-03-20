const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const { createUser } = require("../controllers/users.controller");
const {
  getPendingCoach,
  validateRoleInClub,
  validatePlayer,
  getPendingPlayers,
  getClubs,
  toggleClubStatus,
  getClubById,
  updateClub,
  completeClubProfile,
  getClubPublicData,
  getMyClubProfile,
  updateMyClub,
  updateCategoriaProfesor,
  getPlayersByClub,
  getPlayersByIdClub,
  getProfesorByIdClub,
  createOrTransferPlayer,
  getTicketsMembresias,
  payTicketMembresia,
  notificarPagoMembresia,
  updatePlayerByClub
} = require("../controllers/clubs.controller");

const { sendRequestJoinToCoach } = require("../controllers/coaches.controller");


// =======================
// PLAYERS (ADMIN CLUB)
// =======================

// Obtener jugador por ID
router.get(
  "/players/:id",
  authMiddleware,
  requireRole("admin_club"),
  getPlayersByIdClub
);

// Listar jugadores del club
router.get(
  "/players-by-club",
  authMiddleware,
  requireRole("admin_club"),
  getPlayersByClub
);

// Crear jugador (flujo nuevo)
router.post(
  "/create-player",
  authMiddleware,
  requireRole("admin_club"),
  createOrTransferPlayer
);

// Crear jugador (flujo viejo - ojo duplicado)
router.post(
  "/create-player",
  authMiddleware,
  requireRole("admin_club"),
  (req, res) => {
    req.body.role = "jugador";
    req.body.clubId = req.user.clubId;
    createUser(req, res);
  }
);

// Validar jugador
router.patch(
  "/:id/validate-player",
  authMiddleware,
  requireRole("admin_club"),
  validatePlayer
);

// Jugadores pendientes
router.get(
  "/pending-players",
  authMiddleware,
  requireRole("admin_club"),
  getPendingPlayers
);


// =======================
// COACHES (ADMIN CLUB)
// =======================

// Obtener coach por ID
router.get(
  "/coaches/:id",
  authMiddleware,
  requireRole("admin_club"),
  getProfesorByIdClub
);

// Actualizar categoría de coach
router.put(
  "/coaches/:id",
  authMiddleware,
  requireRole("admin_club"),
  updateCategoriaProfesor
);

//Actualizar jugador
router.put(
  "/players/:id",
  authMiddleware,
  requireRole("admin_club"),
  updatePlayerByClub
);

// Crear profesor
router.post(
  "/create-professor",
  authMiddleware,
  requireRole("admin_club"),
  (req, res) => {
    req.body.role = "profesor";
    createUser(req, res);
  }
);

// Solicitud a coach
router.post(
  "/request-coach",
  authMiddleware,
  requireRole("admin_club"),
  sendRequestJoinToCoach
);

// Coaches pendientes
router.get(
  "/pending-coaches",
  authMiddleware,
  requireRole("admin_club"),
  getPendingCoach
);

// Validar coach
router.patch(
  "/:id/validate-coach",
  authMiddleware,
  requireRole("admin_club"),
  validateRoleInClub
);


// =======================
// CATEGORÍAS
// =======================

router.get(
  "/my/categories",
  authMiddleware,
  requireRole("admin_club"),
  async (req, res) => {
    try {
      const categoriasSnap = await db
        .collection("categorias")
        .where("clubId", "==", req.user.clubId)
        .get();

      const categorias = categoriasSnap.docs.map(doc => doc.data().nombre);

      res.json(categorias);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener categorías" });
    }
  }
);


// =======================
// MEMBRESÍAS
// =======================

router.get(
  "/membresias",
  authMiddleware,
  requireRole("admin_club"),
  getTicketsMembresias
);

router.post(
  "/membresias/:ticketMembresiaId/pay",
  authMiddleware,
  requireRole("admin_club"),
  payTicketMembresia
);

router.patch(
  "/membresias/ticket/:ticketId/notificar",
  authMiddleware,
  requireRole("admin_club"),
  notificarPagoMembresia
);


// =======================
// PERFIL CLUB
// =======================

// Perfil propio
router.get(
  "/me",
  authMiddleware,
  requireRole("admin_club"),
  getMyClubProfile
);

router.put(
  "/me",
  authMiddleware,
  requireRole("admin_club"),
  updateMyClub
);

// Completar perfil
router.post(
  "/:clubId/complete-profile",
  completeClubProfile
);


// =======================
// PÚBLICO
// =======================

router.get("/public/:clubId", getClubPublicData);


// =======================
// ADMIN ASAMBAL
// =======================

// Listar clubes
router.get(
  "/",
  authMiddleware,
  requireRole("admin_asambal"),
  getClubs
);

// Obtener club por ID
router.get(
  "/:id",
  authMiddleware,
  requireRole("admin_asambal", "admin_club"),
  getClubById
);

// Actualizar club
router.put(
  "/:id",
  authMiddleware,
  requireRole("admin_asambal"),
  updateClub
);

// Toggle estado club
router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole("admin_asambal"),
  toggleClubStatus
);


module.exports = router;