const express = require("express");
const { crearPreferencia } = require("../controllers/mercadopago.controller");

const router = express.Router();

router.post("/crear-preferencia", crearPreferencia);
console.log("MercadoPago routes cargadas");

module.exports = router;