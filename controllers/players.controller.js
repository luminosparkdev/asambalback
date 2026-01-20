
const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

const serializeTimestamps = (data) => {
  const result = {};
  for (const key in data) {
    if (data[key]?.toDate) {
      result[key] = data[key].toDate();
    } else {
      result[key] = data[key];
    }
  }
  return result;
};

// GENERAMOS TOKEN
const generateActivationToken = () => crypto.randomBytes(20).toString("hex");

// CREAR JUGADOR y USUARIO JUGADOR
const createPlayer = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      categoria,
    } = req.body;

    // VALIDAR DATOS OBLIGATORIOS
    if (
      !nombre ||
      !apellido ||
      !email ||
      !categoria
    ) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
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
        role: "jugador",
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
        email,
        categoria,
        habilitadoParaJugar: false,
        motivoInhabilitacion: "EMPADRONAMIENTO_PENDIENTE",
        becado: false,
        fechaHabilitacion: null,
        clubName: req.user.nombreClub,
        clubId: req.user.clubId,
        coachId,
        userId: userRef.id,
        status: "INCOMPLETO",
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
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      }));
      res.json(players);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
  }
};

const getPlayersByCoach = async (req, res) => {
  const { coachId } = req.user;

  if (!coachId) {
    return res.status(400).json({ message: "CoachId no proporcionado" });
  }

  try {
      const snapshot = await db
      .collection("jugadores")
      .where("coachId", "==", coachId)
      .get();

      const players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      }));
      res.json(players);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
  }
};

const getPlayerById = async (req, res) => {
  try {
    const doc = await db.collection("jugadores").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    res.json({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("jugadores").doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const docData = snap.data();

    await docRef.update({
      nombre: req.body.nombre ?? docData.nombre,
      apellido: req.body.apellido ?? docData.apellido,
      sexo: req.body.sexo ?? docData.sexo,
      fechanacimiento: req.body.fechaNacimiento ?? docData.fechaNacimiento,
      edad: req.body.edad ?? docData.edad,
      dni: req.body.dni ?? docData.dni,
      email: req.body.email ?? docData.email,
      telefono: req.body.telefono ?? docData.telefono,
      domicilio: req.body.domicilio ?? docData.domicilio,
      domiciliocobro: req.body.domiciliocobro ?? docData.domiciliocobro,
      categoria: req.body.categoria ?? docData.categoria,
      nivel: req.body.nivel ?? docData.nivel,
      peso: req.body.peso ?? docData.peso,
      estatura: req.body.estatura ?? docData.estatura,
      escuela: req.body.escuela ?? docData.escuela,
      turno: req.body.turno ?? docData.turno,
      instagram: req.body.instagram ?? docData.instagram,
      reglasclub: req.body.reglasclub ?? docData.reglasclub,
      usoimagen: req.body.usoimagen ?? docData.usoimagen,
      horariocobro: req.body.horariocobro ?? docData.horariocobro,
      año: req.body.año ?? docData.año,
      updatedAt: new Date(),
    });

    res.json({ message: "Jugador modificado exitosamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const togglePlayerStatus = async (req, res) => {
  try {
    const ref = db.collection("jugadores").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const newStatus = snap.data().status === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    await ref.update({
      status: newStatus,
      updatedAt: new Date(),
    });
    res.json({ message: "Estado del jugador actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const completePlayerProfile = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user.id;

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
        status: "PENDIENTE",
        updatedAt: new Date(),
      });

      tx.update(db.collection("usuarios").doc(userId), {
        status: "PENDIENTE",
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
      .where("status", "==", "PENDIENTE")
      .get();

    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    }));

    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const validatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const {action} = req.body;

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    const playerRef = db.collection("jugadores").doc(id);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const { userId } = playerDoc.data();
    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    await db.runTransaction(async (tx) => {
      tx.update(playerRef, {
        status: newStatus,
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

const getMyPlayerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const snapshot = await db
      .collection("jugadores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const doc = snapshot.docs[0];
    const data = serializeTimestamps(doc.data());

    // Devuelvo todo plano para que el frontend lo use directamente
    res.json({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toISOString() || null,
      updatedAt: data.updatedAt?.toISOString() || null,
      status: data.status || "INACTIVO",
      tutor: data.tutor || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const updateMyPlayerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const snapshot = await db
      .collection("jugadores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const ref = snapshot.docs[0].ref;

    // CAMPOS EDITABLES
    const allowedFields = [
      "dni", "sexo", "fechanacimiento", "edad", "estatura", "peso",
      "domicilio", "telefono", "instagram", "escuela", "nivel",
      "año", "turno", "domiciliocobro", "horariocobro", "manohabil"
    ];

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    updateData.updatedAt = new Date();

    await ref.update(updateData);

    const updatedSnap = await ref.get();
    const data = serializeTimestamps(updatedSnap.data());

    res.json({
      id: ref.id,
      ...data,
      createdAt: data.createdAt?.toISOString() || null,
      updatedAt: data.updatedAt?.toISOString() || null,
      status: data.status || "INACTIVO",
      tutor: data.tutor || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createPlayer,
  getPlayers,
  getPlayersByCoach,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  getPendingPlayers,
  validatePlayer,
  getMyPlayerProfile,
  updateMyPlayerProfile,
};
