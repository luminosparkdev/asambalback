const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");
const { uploadClubHero } = require("../controllers/heroclubs.controller");
const upload = require("../middlewares/upload.middleware");

router.post(
  "/clubs/:clubId/hero",
  authMiddleware,
  requireRole("admin_club"),
  upload.single("hero"),
  uploadClubHero
);

module.exports = router;
