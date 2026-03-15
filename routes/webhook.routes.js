const express = require("express");
const { mercadopagoWebhook } = require("../controllers/webhook.controller");

const router = express.Router();

router.post("/mercadopago", mercadopagoWebhook);

module.exports = router;