const express = require("express");
const router = express.Router();
const { login, activateAccount, refreshToken } = require("../controllers/auth.controller");

router.post("/login", login);
router.post("/activate-account", activateAccount);
router.post("/refresh", refreshToken);

module.exports = router;
