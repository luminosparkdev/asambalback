const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");

const crearPreferencia = async (req, res) => {
  try {

    const { tipo, userId, email } = req.body;

    let title;
    let price;

    if (tipo === "empadronamiento") {
      title = "Empadronamiento ASAMBAL";
      price = 10000;
    }

    if (tipo === "seguro") {
      title = "Seguro anual profesor";
      price = 15000;
    }

    if (tipo === "membresia") {
      title = "Membresía club";
      price = 50000;
    }

    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            quantity: 1,
            unit_price: price,
            currency_id: "ARS",
          },
        ],

        payer: {
          email: email,
        },

        external_reference: String(userId),

        metadata: {
          tipo_pago: tipo,
          user_id: userId,
          ticket_id: req.body.ticketId
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