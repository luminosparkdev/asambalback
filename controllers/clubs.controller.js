const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAMOS CLUB CON ADMIN
const createClubWithAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin_asambal") {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const { clubName, city, adminEmail, manager, venue, telephone } = req.body;

    console.log(req.body)


    if (!clubName || !adminEmail || !manager || !venue || !telephone || !city) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    // CHEQUEO USUARIO EXISTENTE
    const existingUser = await db
      .collection("usuarios")
      .where("email", "==", adminEmail)
      .get();

    if (!existingUser.empty) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    // GENERAMOS TOKEN DE ACTIVACIÓN
    const activationToken = generateActivationToken();

    // CREACIÓN CLUB Y USUARIO ADMIN EN UNA TRANSACCIÓN
    await db.runTransaction(async (tx) => {
      const clubRef = db.collection("clubes").doc();

      tx.set(clubRef, {
        nombre: clubName,
        ciudad: city || "",
        isActive: true,
        responsable: manager,
        sede: venue,
        telefono: telephone,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const userRef = db.collection("usuarios").doc();

      tx.set(userRef, {
        email: adminEmail,
        role: "admin_club",
        clubId: clubRef.id,

        active: false,
        activationToken,

        createdBy: req.user.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // GUARDAMOS USUARIO Y ENVIAMOS MAIL DE ACTIVACIÓN
    await sendActivationEmail(adminEmail, activationToken, adminEmail);

    res.json({ success: true, message: "Club y admin creados correctamente" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//NORMALIZAMOS FECHAS
const normalizeDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Timestamp de Firestore
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  // Objeto crudo {_seconds}
  if (value._seconds) {
    return new Date(value._seconds * 1000).toISOString();
  }

  return null;
};

// OBTENEMOS CLUBES
const getClubs = async (req, res) => {
  try {
    const snapshot = await db.collection("clubes").get();
    const clubs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: normalizeDate(doc.data().createdAt),
      updatedAt: normalizeDate(doc.data().updatedAt),
    }));

    res.json(clubs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GESTIONAMOS ESTADO DEL CLUB
const toggleClubStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const clubRef = db.collection("clubes").doc(id);
    const snap = await clubRef.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Club no encontrado" });
    }

    const currentStatus = snap.data().isActive;

    await clubRef.update({
      isActive: !currentStatus,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      isActive: !currentStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// OBTENEMOS CLUB POR ID
const getClubById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("clubes").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Club no encontrado" });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
      createdAt: normalizeDate(doc.data().createdAt),
      updatedAt: normalizeDate(doc.data().updatedAt),
    });
  } catch (error) {
    res.status(500).json({ message: "Error obteniendo club" });
  }
};

//EDITAMOS CLUBES

const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, ciudad, responsable, sede, telefono, email} = req.body;

    const clubRef = db.collection("clubes").doc(id);
    const snap = await clubRef.get();

    if (!nombre || !ciudad || !responsable || !sede || !telefono || !email) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    if (!snap.exists) {
      return res.status(404).json({ message: "Club no encontrado" });
    }

    await clubRef.update({
      nombre,
      ciudad,
      responsable,
      sede,
      telefono,
      email,
      updatedAt: new Date(),
    });

    const updated = await clubRef.get();

    res.json({
      success: true,
      club: {
        id: updated.id,
        ...updated.data(),
        createdAt: normalizeDate(updated.data().createdAt),
        updatedAt: normalizeDate(updated.data().updatedAt),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createClubWithAdmin, getClubs, toggleClubStatus, getClubById, updateClub };
