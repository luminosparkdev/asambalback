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
  getPlayersByClub,
  createOrTransferPlayer,
  getTicketsMembresias,
  payTicketMembresia
} = require("../controllers/clubs.controller");
const { sendRequestJoinToCoach } = require("../controllers/coaches.controller");

// --- CREAR JUGADOR DESDE ADMIN CLUB ---
router.post(
  "/create-player",
  authMiddleware,
  requireRole("admin_club"),
  createOrTransferPlayer
);

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
    req.body.clubId = req.user.clubId;
    createUser(req, res);
  });

// CATEGORIAS
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

//MEMBRESIAS
// Obtener tickets de membresias del club
router.get("/membresias", authMiddleware, requireRole("admin_club"), getTicketsMembresias);

router.post(
  "/membresias/:ticketMembresiaId/pay",
  authMiddleware,
  requireRole("admin_club"),
  payTicketMembresia
);

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