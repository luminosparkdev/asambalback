const express = require("express");
const router = express.Router();
const  { crearCuota, getCuotas, getCuotaDetalle, aplicarProrroga, getCuotasJugador } = require ("../controllers/cuotas.controller.js");

router.post("/crear", crearCuota);
router.get("/", getCuotas);
router.get("/:id", getCuotaDetalle);
router.patch("/prorroga/:cuotaId/:jugadorId", aplicarProrroga);
router.get("/me", getCuotasJugador)

module.exports = router;