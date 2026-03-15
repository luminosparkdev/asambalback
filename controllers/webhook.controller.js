const { Payment } = require("mercadopago");
const mpClient = require("../config/mercadopago");
const admin = require("firebase-admin");

const db = admin.firestore();

const mercadopagoWebhook = async (req, res) => {
  try {

    const { type, data } = req.body;

    // ignoramos eventos que no sean pagos
    if (type !== "payment" || !data?.id) {
      return res.status(200).send("Evento ignorado");
    }

    const payment = new Payment(mpClient);

    const paymentInfo = await payment.get({
      id: data.id
    });

    const status = paymentInfo.status;
    const metadata = paymentInfo.metadata || {};
    const paymentId = String(paymentInfo.id);

    const tipoPago = metadata.tipo_pago;
    const ticketId = metadata.ticket_id;
    const userId = metadata.user_id;

    console.log("Webhook MP:", paymentId, status, tipoPago);

    // solo procesamos pagos aprobados
    if (status !== "approved") {
      return res.status(200).send("Pago no aprobado aún");
    }

    if (!tipoPago) {
      console.log("Pago sin metadata tipoPago:", paymentId);
      return res.status(200).send("Sin metadata");
    }

    if (tipoPago === "empadronamiento") {
      await procesarEmpadronamiento(paymentInfo, ticketId);
    }

    if (tipoPago === "seguro") {
      await procesarSeguro(paymentInfo, userId);
    }

    res.status(200).send("ok");

  } catch (error) {

    console.error("Error webhook MP:", error);
    res.status(500).send("error");

  }
};

module.exports = {
  mercadopagoWebhook
};

const procesarEmpadronamiento = async (paymentInfo, ticketId) => {

  const cuotaNumero = Number(paymentInfo.metadata?.cuota_numero);
  const paymentId = String(paymentInfo.id);

  if (!ticketId || !cuotaNumero) {
    console.log("Metadata incompleta en pago:", paymentId);
    return;
  }

  const ticketRef = db.collection("ticketsEmpadronamiento").doc(ticketId);
  const pagoRef = db.collection("pagos").doc(paymentId);

  await db.runTransaction(async (transaction) => {

    const ticketSnap = await transaction.get(ticketRef);
    const pagoSnap = await transaction.get(pagoRef);

    if (!ticketSnap.exists) {
      throw new Error("Ticket no encontrado");
    }

    // idempotencia: si el pago ya existe salimos
    if (pagoSnap.exists) {
      console.log("Pago ya procesado:", paymentId);
      return;
    }

    const ticket = ticketSnap.data();

    const cuotasActualizadas = ticket.cuotas.map((cuota) => {

      if (Number(cuota.number) === cuotaNumero) {

        // si ya estaba acreditada, no hacemos nada
        if (cuota.status === "acreditado") {
          return cuota;
        }

        return {
          ...cuota,
          status: "acreditado",
          paymentId
        };
      }

      return cuota;

    });

    transaction.update(ticketRef, {
      cuotas: cuotasActualizadas,
      updatedAt: new Date()
    });

    transaction.set(pagoRef, {

      paymentId,

      tipoPago: "empadronamiento",

      status: paymentInfo.status,

      monto: paymentInfo.transaction_amount,

      metodoPago: paymentInfo.payment_method_id,
      tipoMetodo: paymentInfo.payment_type_id,

      payerEmail: paymentInfo.payer?.email || null,

      fechaCreacionMP: paymentInfo.date_created,
      fechaAprobacionMP: paymentInfo.date_approved,

      metadata: paymentInfo.metadata,

      createdAt: new Date()

    });

  });

  // habilitamos jugador fuera de la transacción
  const ticketSnap = await ticketRef.get();
  const ticket = ticketSnap.data();

  await db
    .collection("jugadores")
    .doc(ticket.jugadorId)
    .update({
      habilitadoAsambal: true
    });

};

const procesarSeguro = async (paymentInfo, profesorId) => {

  if (!profesorId) return;

  const snap = await db
    .collection("seguroProfesores")
    .where("profesorId", "==", profesorId)
    .where("year", "==", 2026)
    .limit(1)
    .get();

  if (snap.empty) return;

  const doc = snap.docs[0];

  const data = doc.data();

  if (data.status === "activo") {
    console.log("Seguro ya activo:", profesorId);
    return;
  }

  await doc.ref.update({
    status: "activo",
    paidAt: new Date(),
    updatedAt: new Date()
  });

  await db
    .collection("profesores")
    .doc(profesorId)
    .update({
      asegurado: true
    });

  await registrarPago(paymentInfo, "seguro");

};

const registrarPago = async (paymentInfo, tipoPago) => {

  const pagoRef = db.collection("pagos").doc(String(paymentInfo.id));

  const pagoSnap = await pagoRef.get();

  // si ya existe, no hacemos nada
  if (pagoSnap.exists) {
    console.log("Pago ya registrado:", paymentInfo.id);
    return;
  }

  await pagoRef.set({

    paymentId: paymentInfo.id,

    tipoPago,

    status: paymentInfo.status,

    monto: paymentInfo.transaction_amount,

    metodoPago: paymentInfo.payment_method_id,
    tipoMetodo: paymentInfo.payment_type_id,

    payerEmail: paymentInfo.payer.email,

    fechaCreacionMP: paymentInfo.date_created,
    fechaAprobacionMP: paymentInfo.date_approved,

    metadata: paymentInfo.metadata,

    createdAt: new Date()

  });

};