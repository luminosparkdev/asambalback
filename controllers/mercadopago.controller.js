const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");

const crearPreferencia = async (req, res) => {
  try {
    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            title: "Empadronamiento ASAMBAL",
            quantity: 1,
            unit_price: 1000,
            currency_id: "ARS",
          },
        ],
        payer: {
      email: "test_user_123@testuser.com",
      identification: {
        type: "DNI",
        number: "12345678",
      },
    },
        back_urls: {
          success: "http://localhost:5173/pago-exitoso",
          failure: "http://localhost:5173/pago-fallido",
          pending: "http://localhost:5173/pago-pendiente",
        },
        //auto_return: "approved",
      },
    });

    res.status(200).json({
      id: result.id,
      sandbox_init_point: result.sandbox_init_point,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error("Error Mercado Pago:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
};

module.exports = {
  crearPreferencia,
};