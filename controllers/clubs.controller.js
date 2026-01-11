const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");
const { logAudit } = require("../utils/auditlogger");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAMOS CLUB CON ADMIN
const createClubWithAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin_asambal") {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const { clubName, city, adminEmail } = req.body;

    console.log(req.body)


    if (!clubName || !adminEmail || !city) {
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
      const userRef = db.collection("usuarios").doc();

      tx.set(clubRef, {
        nombre: clubName,
        ciudad: city || "",
        email: adminEmail,
        status: "incompleto",
        createdBy: req.user.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      tx.set(userRef, {
        email: adminEmail,
        role: "admin_club",
        clubId: clubRef.id,
        status: "incompleto",
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

    let newStatus = null;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(clubRef);

      if (!snap.exists) {
        throw new Error("Club no encontrado");
      }

      const currentStatus = snap.data().status;

      if (!["ACTIVO", "INACTIVO"].includes(currentStatus)) {
        throw new Error(`No se puede cambiar el estado del club desde ${currentStatus}`);
      }

      newStatus = currentStatus === "ACTIVO" ? "INACTIVO" : "ACTIVO";

      tx.update(clubRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      if (newStatus === "INACTIVO") {
        const userSnap = await db
          .collection("usuarios")
          .where("clubId", "==", id)
          .where("status", "==", "ACTIVO")
          .get();

        userSnap.forEach(doc => {
          tx.update(doc.ref, {
            status: "INACTIVO",
            updatedAt: new Date(),
          });
        });
      }
    });

    await logAudit({
      req,
      action:
        newStatus === "INACTIVO"
          ? "DEACTIVATE_CLUB_AND_USERS"
          : "ACTIVATE_CLUB",
      entity: "clubes",
      entityId: id,
    });

    res.json({
      success: true,
      status: newStatus,
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

    await logAudit({
      req,
      action: "UPDATE_CLUB",
      entity: "clubes",
      entityId: id,
      payload: req.body,
    });

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

const completeClubProfile = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { responsable, sede, telefono, canchas, canchasAlternativas } = req.body;

    if (clubId !== req.user.clubId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    await db.runTransaction(async (tx) => {
      const clubRef = db.collection("clubes").doc(clubId);
      const clubSnap = await tx.get(clubRef);

      if (!clubSnap.exists) {
        throw new Error("Club no encontrado");
      }

      tx.update(clubRef, {
        responsable,
        sede,
        telefono,
        canchas,
        canchasAlternativas,
        status: "PENDIENTE",
        updatedAt: new Date(),
      });

      const userSnap = await db
        .collection("usuarios")
        .where("clubId", "==", clubId)
        .where("role", "==", "admin_club")
        .limit(1)
        .get();

      if (!userSnap.empty) {
        tx.update(userSnap.docs[0].ref, {
          status: "PENDIENTE",
          updatedAt: new Date(),
        });
      }
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createClubWithAdmin, getClubs, toggleClubStatus, getClubById, updateClub, completeClubProfile };
