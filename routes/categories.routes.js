const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const { getCategories } = require("../controllers/categories.controller");

// solo usuarios logueados (admin, club, lo que sea)
router.get(
    "/",
    authMiddleware,
    requireRole("admin_asambal", "admin_club", "profesor"),
    getCategories
);

module.exports = router;
