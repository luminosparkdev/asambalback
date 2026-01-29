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
        clubId: clubRef.id,
        roles: ["admin_club"],
        status: "INCOMPLETO",
        activationToken,
        clubs: [{ nombre: clubName, clubId: clubRef.id }],
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
    console.log("USER: ", req.user);
    const clubId = req.user.clubs?.[0]?.clubId;

    if (!clubId) {
      return res.status(400).json({ message: "Club no asociado al usuario" });
    }

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
    const clubId = req.user.clubs?.[0]?.clubId;

    if (!clubId) {
      return res.status(400).json({ message: "Club no asociado al usuario" });
    }

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
    const { action } = req.body;
    const userId = req.params.id;

    if (action !== "APPROVE") {
      return res.status(400).json({ message: "Acción no válida" });
    }

    const activeClub = req.user.clubs?.[0];
    if (!activeClub?.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const clubId = activeClub.clubId;
    const now = new Date();

    const userRef = db.collection("usuarios").doc(userId);
    const profRef = db.collection("profesores").doc(userId);

    await db.runTransaction(async (tx) => {
      // ================= LECTURAS =================
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error("Usuario no encontrado");
      }

      const profSnap = await tx.get(profRef);
      if (!profSnap.exists) {
        throw new Error("Documento profesor no encontrado");
      }

      const userData = userSnap.data();
      const profData = profSnap.data();

      const roles = Array.isArray(userData.roles)
        ? userData.roles
        : Object.values(userData.roles || {});

      if (!roles.includes("profesor")) {
        throw new Error("El usuario no es profesor");
      }

      // ================= CÁLCULOS =================
      const updatedUserClubs = userData.clubs.map(c =>
        c.clubId === clubId
          ? { ...c, status: "ACTIVO" }
          : c
      );

      const updatedProfClubs = profData.clubs.map(c =>
        c.clubId === clubId
          ? { ...c, status: "ACTIVO" }
          : c
      );

      const userUpdates = {
        clubs: updatedUserClubs,
        updatedAt: now,
      };

      if (userData.status === "PENDIENTE") {
        userUpdates.status = "ACTIVO";
      }

      const profUpdates = {
        clubs: updatedProfClubs,
        updatedAt: now,
      };

      if (profData.status !== "ACTIVO") {
        profUpdates.status = "ACTIVO";
      }

      // ================= ESCRITURAS =================
      tx.update(userRef, userUpdates);
      tx.update(profRef, profUpdates);
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ ERROR validateRoleInClub:", err);
    return res.status(500).json({ message: err.message });
  }
};

const getPendingCoach = async (req, res) => {
  try {
    const activeClub = req.user.clubs?.[0];

    if (!activeClub?.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const clubId = activeClub.clubId;

    const snapshot = await db
      .collection("profesores")
      .get();

    const pendingUsers = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      const clubData = data.clubs?.find(
        c => c.clubId === clubId && c.status === "PENDIENTE"
      );

      if (clubData) {
        pendingUsers.push({
          id: doc.id,
          email: data.email,
          nombre: data.nombre,
          apellido: data.apellido,
          role: "profesor",
          status: "PENDIENTE",
          categorias: clubData.categorias || [],
          clubId,
        });
      }
    });

    res.json(pendingUsers);
  } catch (err) {
    console.error("❌ ERROR getPendingCoach:", err);
    res.status(500).json({ message: err.message });
  }
};

const getPlayersByClub = async (req, res) => {
  try {
    // Club que administra el admin (solo 1)
    const clubId = req.user.clubs?.[0]?.clubId;
    console.log("Admin Club ID:", clubId);
    if (!clubId) {
      return res.status(403).json({ message: "No tiene clubes asignados" });
    }
    
    const snapshot = await db.collection("jugadores").where("clubId", "==", clubId).get();
    console.log("Documentos encontrados:", snapshot.size);
    const players = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: normalizeDate(doc.data().createdAt),
      updatedAt: normalizeDate(doc.data().updatedAt),
    }));
    res.json(players);
  } catch (err) {
    console.error("❌ ERROR getPlayersByClub:", err);
    res.status(500).json({ message: err.message });
  }
};





module.exports = { createClubWithAdmin, getClubs, toggleClubStatus, getClubById, updateClub, completeClubProfile, getMyClubProfile, updateMyClub, validateRoleInClub, getPendingCoach, getPlayersByClub };