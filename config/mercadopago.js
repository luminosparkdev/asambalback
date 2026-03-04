const { MercadoPagoConfig } = require("mercadopago");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

module.exports = mpClient;