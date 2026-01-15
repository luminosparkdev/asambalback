const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () => crypto.randomBytes(20).toString("hex");

// CREAR JUGADOR y USUARIO JUGADOR
const createPlayer = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      sexo,
      fechanacimiento, // debe coincidir con frontend
      edad,
      dni,
      email,
      telefono,
      domicilio,
      domiciliocobro,
      categoria,
      nivel,
      peso,
      estatura,
      escuela,
      turno,
      instagram,
      reglasclub,
      usoimagen,
      horariocobro,
      año,
      tutor, // opcional si <16
    } = req.body;

    // VALIDAR DATOS OBLIGATORIOS
    if (
      !nombre ||
      !apellido ||
      !sexo ||
      !fechanacimiento ||
      !edad ||
      !dni ||
      !email ||
      !telefono ||
      !domicilio ||
      !categoria
    ) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Validar aceptación de términos obligatorios
    if (reglasclub !== true || usoimagen !== true) {
      return res.status(400).json({ message: "Debes aceptar las reglas del club y el uso de imagen para continuar" });
    }

    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    // Buscar coachId correcto (id documento de profesor)
    const profSnapshot = await db
      .collection("profesores")
      .where("email", "==", req.user.email)
      .limit(1)
      .get();

    if (profSnapshot.empty) {
      return res.status(400).json({ message: "Profesor no encontrado" });
    }

    const coachId = profSnapshot.docs[0].id;

    // Verificar que no exista ya jugador con mismo email
    const existing = await db
      .collection("jugadores")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ message: "El jugador ya existe" });
    }

    const activationToken = generateActivationToken();
    const userRef = db.collection("usuarios").doc();
    const playerRef = db.collection("jugadores").doc();

    await db.runTransaction(async (tx) => {
      // USUARIO
      tx.set(userRef, {
        email,
        role: "player",
        clubId: req.user.clubId,
        status: "INCOMPLETO",
        activationToken,
        createdBy: req.user.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // PERFIL JUGADOR
      tx.set(playerRef, {
        nombre,
        apellido,
        sexo,
        fechanacimiento,
        edad,
        dni,
        email,
        telefono,
        domicilio,
        domiciliocobro,
        categoria,
        nivel,
        peso,
        estatura,
        escuela,
        turno,
        instagram,
        reglasclub,
        usoimagen,
        horariocobro,
        año,
        tutor: edad < 16 ? tutor || {} : null,

        clubId: req.user.clubId,
        coachId,
        userId: userRef.id,
        status: "INCOMPLETO",
        isActive: true,
        isAuthorized: false,
        imageAuthorization: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await sendActivationEmail(email, activationToken, email);

    res.json({ success: true, id: userRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


const getPlayers = async (req, res) => {
  try {
      const snapshot = await db.collection("jugadores").get();
      const players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(players);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
  }
};

const getPlayerById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("jugadores").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellido,
      sexo,
      fechanacimiento,
      edad,
      dni,
      email,
      telefono,
      domicilio,
      domiciliocobro,
      categoria,
      nivel,
      peso,
      estatura,
      escuela,
      turno,
      instagram,
      reglasclub,
      usoimagen,
      horariocobro,
      año,
    } = req.body;

    const doc = await db.collection("jugadores").doc(id).get();
    if (!doc.exists) {
        return res.status(404).json({ message: "Jugador no encontrado" });
    }

    await db.collection("jugadores").doc(id).update({
        nombre: nombre || doc.data().nombre, // si no viene, mantiene el valor actual
        apellido: apellido || doc.data().apellido, // si no viene, mantiene el valor actual
        sexo: sexo || doc.data().sexo, // si no viene, mantiene el valor actual
        fechanacimiento: fechanacimiento || doc.data().fechanacimiento, // si no viene, mantiene el valor actual
        edad: edad || doc.data().edad, // si no viene, mantiene el valor actual
        dni: dni || doc.data().dni, // si no viene, mantiene el valor actual
        email: email || doc.data().email, // si no viene, mantiene el valor actual
        telefono: telefono || doc.data().telefono, // si no viene, mantiene el valor actual
        domicilio: domicilio || doc.data().domicilio, // si no viene, mantiene el valor actual
        domiciliocobro: domiciliocobro || doc.data().domiciliocobro, // si no viene, mantiene el valor actual
        categoria: categoria || doc.data().categoria, // si no viene, mantiene el valor actual
        nivel: nivel || doc.data().nivel, // si no viene, mantiene el valor actual
        peso: peso || doc.data().peso, // si no viene, mantiene el valor actual
        estatura: estatura || doc.data().estatura, // si no viene, mantiene el valor actual
        escuela: escuela || doc.data().escuela, // si no viene, mantiene el valor actual
        turno: turno || doc.data().turno ,// si no viene, mantiene el valor actual
        instagram: instagram || doc.data().instagram ,// si no viene, mantiene el valor actual
        reglasclub: reglasclub || doc.data().reglasclub ,// si no viene, mantiene el valor actual
        usoimagen: usoimagen || doc.data().usoimagen ,// si no viene, mantiene el valor actual
        horariocobro: horariocobro || doc.data().horariocobro ,// si no viene, mantiene el valor actual
        año: año||doc.data().año ,//si 16 o más se puede actualizar

    });

    res.json({ message: "Jugador modificado exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const togglePlayerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("jugadores").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }
    const currentStatus = doc.data().estado;
    await db.collection("jugadores").doc(id).update({
      estado: !currentStatus
    });
    res.json({ message: "Estado del jugador actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const completePlayerProfile = async (req, res) => {
  try {
    const { token } = req.params;
    const data = req.body;

    const userSnap = await db
      .collection("usuarios")
      .where("activationToken", "==", token)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    const userDoc = userSnap.docs[0];
    const userId = userDoc.id;

    const playerSnap = await db
      .collection("jugadores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (playerSnap.empty) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const playerDoc = playerSnap.docs[0];

    await db.runTransaction(async (tx) => {
      tx.update(db.collection("jugadores").doc(playerDoc.id), {
        ...data,
        status: "PENDIENTE_VALIDACION",
        updatedAt: new Date(),
      });

      tx.update(db.collection("usuarios").doc(userId), {
        status: "PENDIENTE_VALIDACION",
        activationToken: null,
        updatedAt: new Date(),
      });
    });

    res.json({ message: "Perfil completado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const getPendingPlayers = async (req, res) => {
  try {
    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const snapshot = await db
      .collection("jugadores")
      .where("clubId", "==", req.user.clubId)
      .where("status", "==", "PENDIENTE_VALIDACION")
      .get();

    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const validatePlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const {action} = req.body;

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    const playerRef = db.collection("jugadores").doc(playerId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const { userId } = playerDoc.data();
    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    await db.runTransaction(async (tx) => {
      tx.update(playerRef, {
        status: "ACTIVO",
        isAuthorized: action === "APPROVE",
        updatedAt: new Date(),
      });

      tx.update(db.collection("usuarios").doc(userId), {
        status: newStatus,
        updatedAt: new Date(),
      });
    });

    res.json({ message: "Jugador validado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  getPendingPlayers,
  validatePlayer,
};
