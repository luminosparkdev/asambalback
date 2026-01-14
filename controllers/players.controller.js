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
      fechanacimiento, // ojo que acá debe coincidir con el frontend
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

    // VALIDAMOS DATOS OBLIGATORIOS
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
      return res.status(400).json({ message: "Faltan datos" });
    }

    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

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
        tutor: edad < 16 ? tutor || {} : null, // solo si <16

        clubId: req.user.clubId,
        coachId: req.user.role === "profesor" && req.user.id ? req.user.id : null,
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
  res.json({ message: "getPlayerById aún no implementado" });
};

const updatePlayer = async (req, res) => {
  res.json({ message: "updatePlayer aún no implementado" });
};

const togglePlayerStatus = async (req, res) => {
  res.json({ message: "togglePlayerStatus aún no implementado" });
};

const completePlayerProfile = async (req, res) => {
  res.json({ message: "completePlayerProfile aún no implementado" });
};

const getPendingPlayers = async (req, res) => {
  res.json({ message: "getPendingPlayers aún no implementado" });
};

const validatePlayer = async (req, res) => {
  res.json({ message: "validatePlayer aún no implementado" });
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
