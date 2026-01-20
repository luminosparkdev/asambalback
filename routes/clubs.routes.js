const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { createClubWithAdmin } = require("../controllers/clubs.controller");
const { getClubs } = require("../controllers/clubs.controller");
const requireRole = require("../middlewares/requireRole.middleware");
const { toggleClubStatus } = require("../controllers/clubs.controller");
const { getClubById } = require("../controllers/clubs.controller");
const { updateClub } = require("../controllers/clubs.controller");
const { completeClubProfile } = require("../controllers/clubs.controller");
const { getMyClubProfile } = require("../controllers/clubs.controller");
const { updateMyClub } = require("../controllers/clubs.controller");

router.post("/", authMiddleware, createClubWithAdmin);
router.post(
    "/:clubId/complete-profile", 
    authMiddleware, 
    requireRole("admin_club"), 
    completeClubProfile
)
router.get("/me", 
    authMiddleware, 
    requireRole("admin_club"), 
    getMyClubProfile
)
router.put("/me", 
    authMiddleware, 
    requireRole("admin_club"), 
    updateMyClub
)
router.get("/", 
    authMiddleware, 
    requireRole("admin_asambal"), 
    getClubs
)
router.patch("/:id/toggle", 
    authMiddleware, 
    requireRole("admin_asambal"), 
    toggleClubStatus
)
router.get("/:id", 
    authMiddleware, 
    requireRole(["admin_asambal", "admin_club"]), 
    getClubById
)
router.put("/:id", 
    authMiddleware, 
    requireRole("admin_asambal"), 
    updateClub
)


module.exports = router;