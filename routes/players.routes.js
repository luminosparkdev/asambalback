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
} = require("../controllers/players.controller");

router.post(
  "/",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  createPlayer
);

router.get(
  "/",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  getPlayers
);

router.get(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  getPlayerById
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  updatePlayer
);

router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole(["profesor", "admin_club"]),
  togglePlayerStatus
);

module.exports = router;
