const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createProfesor,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
} = require("../controllers/coaches.controller");

router.post(
  "/",
  authMiddleware,
  requireRole("admin_club"),
  createProfesor
);

router.get(
  "/",
  authMiddleware,
  requireRole("admin_club"),
  getProfesores
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("admin_club"),
  getProfesorById
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("admin_club"),
  updateProfesor
);

router.patch(
  "/:id/toggle",
  authMiddleware,
  requireRole("admin_club"),
  toggleProfesorStatus
);

module.exports = router;
