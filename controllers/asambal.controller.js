const { db } = require("../config/firebase");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");
const admin = require("firebase-admin");

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

const calcularVencimiento = () => {
  const now = new Date();
  const year = now.getMonth() >= 1 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 1, 28, 23, 59, 59);
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

//FUNCION PARA CONSULTAR JUGADORES BECADOS
const getPlayersWithScholarship = async (req, res) => {
  try {
    const snapshot = await db
      .collection("becas")
      .where("estado", "==", "ACTIVA")
      .get();

    const becados = snapshot.docs.map(doc => ({
      id: doc.id,
      ...serializeTimestamps(doc.data()),
    }));

    res.json(becados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener becados" });
  }
};

//FUNCION PARA CONSULTAR EL HISTORIAL DE BECAS DE UN JUGADOR
const getPlayerScholarshipHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const becasSnap = await db
      .collection("becas")
      .where("playerId", "==", id)
      .orderBy("fechaOtorgamiento", "desc")
      .get();

    const becas = becasSnap.docs.map(doc => ({
      id: doc.id,
      ...serializeTimestamps(doc.data()),
    }));

    res.json(becas);
  } catch (error) {
    console.error("Error obteniendo historial de becas:", error);
    res.status(500).json({ message: "Error al obtener historial de becas" });
  }
};

//FUNCION PARA BECAR JUGADORES
const grantScholarship = async (req, res) => {
  try {
    const { id: playerId } = req.params;
    const asambalId = req.user.id;

    const playerRef = db.collection("jugadores").doc(playerId);
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const player = playerSnap.data();

    // 🔒 Validar que NO tenga una beca activa
    const activeBecaSnap = await db
      .collection("becas")
      .where("playerId", "==", playerId)
      .where("estado", "==", "ACTIVA")
      .limit(1)
      .get();

    if (!activeBecaSnap.empty) {
      return res.status(400).json({
        message: "El jugador ya tiene una beca activa",
      });
    }

    const club = player.clubs?.[0]; // regla actual
    const now = admin.firestore.Timestamp.now();

    const beca = {
      playerId,
      nombre: player.nombre,
      apellido: player.apellido,

      clubId: club?.clubId || null,
      nombreClub: club?.nombreClub || null,
      categorias: club?.categorias || [],

      fechaOtorgamiento: now,
      fechaVencimiento: calcularVencimiento(),
      fechaRevocacion: null,

      estado: "ACTIVA",
      otorgadaPor: asambalId,

      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    const becaRef = db.collection("becas").doc();

    batch.set(becaRef, beca);

    batch.update(playerRef, {
      becado: true,
      habilitadoAsambal: true,
      updatedAt: now,
    });

    await batch.commit();

    res.json({
      message: "Jugador becado correctamente",
      becaId: becaRef.id,
      playerId,
    });
  } catch (error) {
    console.error("Error al becar jugador:", error);
    res.status(500).json({ message: "Error al becar jugador" });
  }
};

//FUNCION PARA QUITAR BECA A JUGADOR
const revokeScholarship = async (req, res) => {
  try {
    const { becaId } = req.params;

    const becaRef = db.collection("becas").doc(becaId);
    const becaSnap = await becaRef.get();

    if (!becaSnap.exists) {
      return res.status(404).json({ message: "Beca no encontrada" });
    }

    const beca = becaSnap.data();

    if (beca.estado !== "ACTIVA") {
      return res.status(400).json({ message: "La beca no está activa" });
    }

    const playerRef = db.collection("jugadores").doc(beca.playerId);
    const playerSnap = await playerRef.get();

    if (!playerSnap.exists) {
      return res.status(404).json({
        message: "Jugador asociado a la beca no encontrado",
      });
    }

    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();

    batch.update(becaRef, {
      estado: "REVOCADA",
      fechaRevocacion: now,
      updatedAt: now,
    });

    batch.update(playerRef, {
      becado: false,
      habilitadoAsambal: false,
      updatedAt: now,
    });

    await batch.commit();

    res.json({
      message: "Beca revocada correctamente",
      becaId,
      playerId: beca.playerId,
    });
  } catch (error) {
    console.error("Error revocando beca:", error);
    res.status(500).json({ message: "Error al revocar beca" });
  }
};

//FUNCION PARA CONSULTAR TODOS LOS PROFESORES
const getAllCoachesAsambal = async (req, res) => {
  try {
    const snapshot = await db.collection("profesores").get();

    const coaches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...serializeTimestamps(doc.data()),
    }));

    res.json(coaches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

//FUNCION PARA CONSULTAR PROFESOR POR ID
const getCoachDetailAsambal = async (req, res) => {
  try {
    const doc = await db.collection("profesores").doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Coach no encontrado" });
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

//FUNCION PARA CREAR EMPADRONAMIENTO ASAMBAL
const createEmpadronamiento = async (req, res) => {
  try {
    const { year, amount } = req.body;

    if (!year || !amount) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    // Crear empadronamiento
    const empadronamientoRef = await db.collection("empadronamientos").add({
      year,
      amount,
      status: "activo",
      createdAt: new Date(),
    });

    const jugadoresSnap = await db.collection("jugadores").get();

    const batch = db.batch();

    for (const doc of jugadoresSnap.docs) {
      const jugador = doc.data();
      const jugadorRef = db.collection("jugadores").doc(doc.id);

      if (jugador.becado) {
        // Becado → habilitado directo
        batch.update(jugadorRef, {
          habilitadoAsambal: true,
        });
      } else {
        // No becado → crear ticket en RAÍZ
        const ticketRef = db.collection("tickets").doc(); // <-- raíz

        batch.set(ticketRef, {
          ticketId: ticketRef.id,           // id del ticket
          empadronamientoId: empadronamientoRef.id, // referencia al empadronamiento
          year,
          jugadorId: doc.id,
          nombre: jugador.nombre,
          email: jugador.email,
          amount,
          status: "pendiente",
          becado: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        batch.update(jugadorRef, {
          habilitadoAsambal: false,
        });
      }
    }

    await batch.commit();

    res.status(201).json({
      message: "Empadronamiento creado correctamente",
      empadronamientoId: empadronamientoRef.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear empadronamiento" });
  }
};


module.exports = { 
  getPendingUsers, 
  validateUser, 
  getMyAsambalProfile, 
  updateMyAsambalProfile, 
  getAllPlayersAsambal, 
  getPlayerDetailAsambal, 
  getPlayersWithScholarship,
  getPlayerScholarshipHistory,
  grantScholarship, 
  revokeScholarship,
  getAllCoachesAsambal,
  getCoachDetailAsambal,
  createEmpadronamiento};