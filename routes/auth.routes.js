const express = require("express");
const router = express.Router();
const { login, activateAccount } = require("../controllers/auth.controller");

router.post("/login", login);
router.post("/activate-account", activateAccount);

module.exports = router;
