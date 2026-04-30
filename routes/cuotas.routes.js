const express = require("express");
const router = express.Router();
const  { crearCuota, getCuotas, getCuotaDetalle, aplicarProrroga, getCuotasJugador, uploadComprobante, validarPago, rechazarPago } = require ("../controllers/cuotas.controller.js");
const upload = require("../middlewares/upload.middleware.js");
router.post("/crear", crearCuota);
router.get("/", getCuotas);
router.get("/me", getCuotasJugador)
router.get("/:id", getCuotaDetalle);
router.patch("/prorroga/:cuotaId/:jugadorId", aplicarProrroga);
router.post("/upload-comprobante/:cuotaId/:jugadorId", upload.single("file"), uploadComprobante);
router.patch("/validar/:cuotaId/:jugadorId", validarPago);
router.patch("/rechazar/:cuotaId/:jugadorId", rechazarPago);

module.exports = router;