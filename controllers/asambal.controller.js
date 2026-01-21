const { db } = require("../config/firebase");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");

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

//FUNCION PARA OBTENER EL PERFIL DEL ADMIN ASAMBAL
const getMyAsambalProfile = async (req, res) => {
  try {
    const snapshot = await db
      .collection("usuarios")
      .where("roles", "array-contains", "admin_asambal")
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ message: "Perfil ASAMBAL no encontrado" });

    const doc = snapshot.docs[0];
    const data = serializeTimestamps(doc.data());

    res.json({ id: doc.id, ...data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA ACTUALIZAR EL PERFIL DEL ADMIN ASAMBAL
const updateMyAsambalProfile = async (req, res) => {
  try {
    const snapshot = await db
      .collection("usuarios")
      .where("roles", "array-contains", "admin_asambal")
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ message: "Perfil ASAMBAL no encontrado" });

    const doc = snapshot.docs[0];
    const currentData = doc.data();

    const updatedPerfil = {
      ...currentData.perfil,
      ...(req.body.perfil || {}),
    };

    const dataToUpdate = {
      perfil: updatedPerfil,
      updatedAt: new Date(),
    };

    await db.collection("usuarios").doc(doc.id).update(dataToUpdate);

    const responseData = {
      id: doc.id,
      ...serializeTimestamps({ ...currentData, ...dataToUpdate }),
    };

    // Devolvemos TODO el admin actualizado
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA OBTENER LOS USUARIOS PENDIENTES
const getPendingUsers = async (req, res) => {
  try {
    const usersSnap = await db
      .collection("usuarios")
      .where("status", "==", "PENDIENTE")
      .get();

    const result = [];

    for (const doc of usersSnap.docs) {
      const user = doc.data();

      // --- Normalizar roles ---
      let rolesArray = [];
      if (typeof user.roles === "string") {
        rolesArray = [user.roles];
      } else if (Array.isArray(user.roles)) {
        rolesArray = user.roles;
      } else if (typeof user.roles === "object" && user.roles !== null) {
        rolesArray = Object.values(user.roles);
      }

      // --- Filtrar solo admin_club ---
      if (!rolesArray.includes("admin_club")) continue;

      // --- Traer club ---
      let club = null;
      if (user.clubId) {
        const clubSnap = await db.collection("clubes").doc(user.clubId).get();
        if (clubSnap.exists) {
          club = clubSnap.data();
        }
      }

      // --- Push final ---
      result.push({
        userId: doc.id,
        email: user.email,
        role: "admin_club",
        club,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("❌ ERROR getPendingUsers:", err);
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA VALIDAR USUARIOS
const validateUser = async (req, res) => {
  try {
    const { userId, action } = req.body; // action = "APPROVE" | "REJECT"
    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) return res.status(404).json({ message: "Usuario no encontrado" });

    const userData = userSnap.data();
    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    // --- Normalizar roles ---
    let rolesArray = [];
    if (typeof userData.roles === "string") {
      rolesArray = [userData.roles];
    } else if (Array.isArray(userData.roles)) {
      rolesArray = userData.roles;
    } else if (typeof userData.roles === "object" && userData.roles !== null) {
      rolesArray = Object.values(userData.roles);
    }

    await db.runTransaction(async tx => {
      tx.update(userRef, { status: newStatus, updatedAt: new Date() });

      // Si es admin_club, sincronizamos club
      if (rolesArray.includes("admin_club") && userData.clubId) {
        const clubRef = db.collection("clubes").doc(userData.clubId);
        tx.update(clubRef, { status: newStatus, updatedAt: new Date() });
      }

      // Crear usuario en Firebase Auth si aprobó
      if (action === "APPROVE") await createAuthUserIfNotExists(userData.email);
    });

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("❌ ERROR validateUser (Asambal):", err);
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA CONSULTAR TODOS LOS JUGADORES
const getAllPlayersAsambal = async (req, res) => {
  try {
    const snapshot = await db.collection("jugadores").get();

    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...serializeTimestamps(doc.data()),
    }));

    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA CONSULTAR JUGADOR POR ID
const getPlayerDetailAsambal = async (req, res) => {
  try {
    const doc = await db.collection("jugadores").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    res.json({
      id: doc.id,
      ...serializeTimestamps(doc.data()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA BECAR JUGADORES
const grantScholarship = async (req, res) => {
  try {
    const ref = db.collection("jugadores").doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    await ref.update({
      becado: true,
      habilitadoParaJugar: true,
      motivoInhabilitacion: null,
      fechaHabilitacion: new Date(),
      updatedAt: new Date(),
    });

    res.json({ message: "Jugador becado y habilitado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


//FUNCION PARA QUITAR BECA A JUGADOR
const revokeScholarship = async (req, res) => {
  try {
    const ref = db.collection("jugadores").doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    await ref.update({
      becado: false,
      habilitadoParaJugar: false,
      motivoInhabilitacion: "EMPADRONAMIENTO_PENDIENTE",
      fechaHabilitacion: null,
      updatedAt: new Date(),
    });

    res.json({ message: "Beca removida correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


module.exports = { getPendingUsers, validateUser, getMyAsambalProfile, updateMyAsambalProfile, getAllPlayersAsambal, getPlayerDetailAsambal, grantScholarship, revokeScholarship };