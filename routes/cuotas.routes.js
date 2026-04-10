const express = require("express");
const router = express.Router();
const  { crearCuota } = require ("../controllers/cuotas.controller.js");


router.post("/cuotas/crear", crearCuota);

module.exports = router;