const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const allowRoles = require("../middlewares/roles.middleware");

const { createUser } = require("../controllers/users.controller");

router.post(
    "/", 
    authMiddleware, 
    allowRoles("admin_asambal", "admin_club", "profesor"), 
    createUser);

module.exports = router;
