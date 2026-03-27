const express = require("express");
const router = express.Router();
const { getFixture } = require ("../controllers/fixture.controller")

router.get(
    "/",
    getFixture
);

module.exports = router;
