const express = require("express");
const router = express.Router();
const { getMyCoachProfile } = require("../controllers/coaches.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/requireRole.middleware");

const {
  createProfesor,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
  validateCoach,
  completeProfesorProfile,
  getPendingCoaches,
  updateMyCoachProfile    
} = require("../controllers/coaches.controller");

router.get(
    "/pending-coaches", 
    authMiddleware, 
    requireRole("admin_club"), 
    getPendingCoaches
);

router.patch(
  "/:coachId/validate-coach",
  authMiddleware,
  requireRole("admin_club"),
  validateCoach
);

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
  "/me",
  authMiddleware,
  requireRole("profesor"),
  getMyCoachProfile
);

router.put(
  "/me",
  authMiddleware,
  requireRole("profesor"),
  updateMyCoachProfile
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

router.post(
    "/complete-profile", 
    authMiddleware,
    requireRole("profesor"),
    completeProfesorProfile
);

module.exports = router;
