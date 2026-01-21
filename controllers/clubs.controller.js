const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAMOS CLUB CON ADMIN
const createClubWithAdmin = async (req, res) => {
  try {

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
        status: "INCOMPLETO",
        createdBy: req.user.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      tx.set(userRef, {
        email: adminEmail,
        roles: ["admin_club"],
        clubId: clubRef.id,
        status: "INCOMPLETO",
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
    const { activationToken, responsable, sede, telefono, canchas, canchasAlternativas } = req.body;

    const userSnap = await db.collection("usuarios")
    .where("activationToken", "==", activationToken)
    .where("clubId", "==", clubId)
    .limit(1)
    .get();

    if (userSnap.empty) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const userRef = userSnap.docs[0].ref;

    await db.runTransaction(async (tx) => {
      const clubRef = db.collection("clubes").doc(clubId);

      tx.update(clubRef, {
        responsable,
        sede,
        telefono,
        canchas,
        canchasAlternativas,
        status: "PENDIENTE",
        updatedAt: new Date(),
      });

      tx.update(userRef, {
        status: "PENDIENTE",
        activationToken: null,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyClubProfile = async (req, res) => {
  try {
    const clubId = req.user.clubId;

    const doc = await db.collection("clubes").doc(clubId).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Club no encontrado" });
    }

    res.json({ id: doc.id, ...doc.data(), 
      createdAt: normalizeDate(doc.data().createdAt),
      updatedAt: normalizeDate(doc.data().updatedAt),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMyClub = async (req, res) => {
  try {
    const clubId = req.user.clubId;

    const allowedFields = [
      "ciudad",
      "telefono",
      "sede",
      "responsable",
      "canchas",
      "canchasAlternativas",
    ];

    const dataToUpdate = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        dataToUpdate[field] = req.body[field];
      }
    });

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ message: "No hay campos válidos para actualizar" });
    }

    dataToUpdate.updatedAt = new Date();

    await db.collection("clubes").doc(clubId).update(dataToUpdate);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const validateRoleInClub = async (req, res) => {
  try {
    const { userId, role, action } = req.body; // role = "profesor" | "jugador"

    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ message: "Usuario no encontrado" });

    const userData = userSnap.data();

    if (!userData.roles?.[role]) return res.status(400).json({ message: `Usuario no tiene rol ${role}` });

    const newEstado = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    // Actualizamos estado en rol dentro de usuarios
    const updatedRoles = { ...userData.roles };
    if (role === "profesor") {
      updatedRoles.profesor.estado = newEstado;
    } else if (role === "jugador") {
      // Solo un club activo a la vez
      updatedRoles.jugador.forEach(j => {
        if (j.clubId === req.user.clubId) j.estado = newEstado;
      });
    }

    await userRef.update({ roles: updatedRoles, updatedAt: new Date() });

    // Actualizamos documento en colección correspondiente
    if (role === "profesor") {
      const profRef = db.collection("profesores").doc(userId);
      await profRef.update({
        estado: newEstado,
        updatedAt: new Date(),
      });
    } else if (role === "jugador") {
      const playerRef = db.collection("jugadores").doc(userId);
      const playerData = (await playerRef.get()).data() || {};
      await playerRef.update({
        estado: newEstado,
        updatedAt: new Date(),
      });
    }

    res.json({ success: true, estado: newEstado });
  } catch (err) {
    console.error("❌ ERROR validateRoleInClub (Admin Club):", err);
    res.status(500).json({ message: err.message });
  }
};

const getPendingUsersInClub = async (req, res) => {
  try {
    const clubId = req.user.clubId;

    // Traemos todos los usuarios que tengan rol profesor o jugador en este club y estado PENDIENTE
    const snapshot = await db.collection("usuarios")
      .where("status", "==", "PENDIENTE")
      .get();

    const pendingUsers = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const roles = data.roles || {};

      // Profesores pendientes en este club
      if (roles.profesor?.clubes?.includes(clubId) && roles.profesor.estado === "PENDIENTE") {
        pendingUsers.push({
          id: doc.id,
          email: data.email,
          role: "profesor",
          estado: "PENDIENTE",
          clubes: roles.profesor.clubes,
          categorias: roles.profesor.categorias,
        });
      }

      // Jugadores pendientes en este club
      if (roles.jugador) {
        roles.jugador.forEach(j => {
          if (j.clubId === clubId && j.estado === "PENDIENTE") {
            pendingUsers.push({
              id: doc.id,
              email: data.email,
              role: "jugador",
              estado: "PENDIENTE",
              clubId: j.clubId,
              categoria: j.categoria,
            });
          }
        });
      }
    });

    res.json(pendingUsers);
  } catch (err) {
    console.error("❌ ERROR getPendingUsersInClub:", err);
    res.status(500).json({ message: err.message });
  }
};


module.exports = { createClubWithAdmin, getClubs, toggleClubStatus, getClubById, updateClub, completeClubProfile, getMyClubProfile, updateMyClub, validateRoleInClub, getPendingUsersInClub };