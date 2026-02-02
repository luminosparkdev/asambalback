const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createPlayer,
  getPlayersByCoach,
  getMyPlayerProfile,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  validatePlayer,
  updateMyPlayerProfile,

  // TRANSFERENCIAS
  // sendTransferRequest,
  getMyTransferRequests,
  respondTransferRequestAdmin,
  getMyPendingTransfers,
  respondTransferRequest,
} = require("../controllers/players.controller");

// ==========================
// TRANSFERENCIAS DE JUGADORES
// ==========================

// SOLICITAR PASE (admin_club)
// router.post(
//   "/transfers",
//   authMiddleware,
//   requireRole("admin_club"),
//   sendTransferRequest
// );

// VER MIS SOLICITUDES DE PASE
// admin_club / asambal / jugador (según lo que devuelva el controller)
router.get(
  "/transfers",
  authMiddleware,
  requireRole("admin_club", "jugador", "asambal"),
  getMyTransferRequests
);


// ACA ARRANCA JUGADOR
router.patch(
  "/transfers/:id/respond",
  authMiddleware,
  requireRole("admin_asambal"), // o como lo tengas definido
  respondTransferRequestAdmin
);

router.use((req, res, next) => {
  console.log("➡️ PLAYER ROUTER:", req.method, req.originalUrl);
  next();
});

router.get(
  "/transfers/player",
  authMiddleware,
  requireRole("jugador"),
  getMyPendingTransfers
);


// RESPONDER SOLICITUD DE PASE
router.patch(
  "/transfers/player/:id/respond",
  authMiddleware,
  requireRole("asambal", "jugador"),
  respondTransferRequest
);



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
  requireRole("profesor", "admin_club", "jugador"),
  getPlayerById
);

// EDITAR JUGADOR (profesor o admin_club)
router.put(
  "/:id",
  authMiddleware,
  requireRole("profesor", "admin_club"),
  updatePlayer
);

// ACTIVAR / DESACTIVAR JUGADOR (profesor o admin_club)
router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole("profesor", "admin_club"),
  togglePlayerStatus
);

module.exports = router;
