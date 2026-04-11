const express = require("express");
const router = express.Router();
const  { crearCuota, getCuotas } = require ("../controllers/cuotas.controller.js");

router.get("/", getCuotas);
router.post("/crear", crearCuota);

module.exports = router;