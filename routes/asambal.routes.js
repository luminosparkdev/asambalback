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
  grantScholarship,
  revokeScholarship,
} = require("../controllers/asambal.controller");

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

router.post(
  "/players/:id/grant-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  grantScholarship
);

router.post(
  "/players/:id/revoke-scholarship",
  authMiddleware,
  requireRole("admin_asambal"),
  revokeScholarship
);

module.exports = router;