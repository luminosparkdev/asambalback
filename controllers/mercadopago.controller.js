const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");
const admin = require("firebase-admin");

const db = admin.firestore();

const crearPreferencia = async (req, res) => {
  console.log("Endpoint crear-preferencia alcanzado");
  try {

    const { tipo, ticketId, cuotaNumero } = req.body;

    let title;

    if (tipo === "empadronamiento") {
      title = "Empadronamiento ASAMBAL";
    }

    if (tipo === "seguro") {
      title = "Seguro anual profesor";
    }

    if (tipo === "membresia") {
      title = "Membresía club";
    }

    let userId;
    let email;
    let price;

    if (tipo === "empadronamiento") {

      const ticketRef = db.collection("ticketsEmpadronamiento").doc(ticketId);
      const ticketSnap = await ticketRef.get();

      if (!ticketSnap.exists) {
        return res.status(404).json({ error: "Ticket no encontrado" });
      }

      const ticket = ticketSnap.data();

      userId = ticket.jugadorId;

      const cuota = ticket.cuotas.find(
        (c) => Number(c.number) === Number(cuotaNumero)
      );

      if (!cuota) {
        return res.status(400).json({ error: "Cuota no encontrada" });
      }

      price = cuota.amount;

      const userSnap = await db.collection("usuarios").doc(userId).get();

      if (!userSnap.exists) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      email = userSnap.data().email;

      const cuotasActualizadas = ticket.cuotas.map((c) => {
        if (Number(c.number) === Number(cuotaNumero)) {
          return {
            ...c,
            status: "pendiente"
          };
        }
        return c;
      });

      await ticketRef.update({
        cuotas: cuotasActualizadas,
        updatedAt: new Date()
      });
    }

    await db.collection("intentosPago").add({

      tipoPago: tipo,
      userId,
      ticketId: ticketId || null,
      cuotaNumero: cuotaNumero || null,
      monto: price,
      estado: "iniciado",
      createdAt: new Date()

    });

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
          ticket_id: ticketId,
          cuota_numero: cuotaNumero
        },

        notification_url: "https://untemperate-unstultifying-mckayla.ngrok-free.dev/api/webhooks/mercadopago",

        back_urls: {
          success: "http://localhost:5173/pago-exitoso",
          failure: "http://localhost:5173/pago-fallido",
          pending: "http://localhost:5173/pago-pendiente",
        }

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