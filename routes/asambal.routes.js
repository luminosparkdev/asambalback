const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const {
  getPendingUsers,
  validateUser,
  getMyAsambalProfile,
  updateMyAsambalProfile,
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

module.exports = router;
