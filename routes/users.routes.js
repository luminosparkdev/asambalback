const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");

const { createUser } = require("../controllers/users.controller");

router.post("/", authMiddleware, createUser);

module.exports = router;
