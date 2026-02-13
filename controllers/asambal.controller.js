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

    // 1️⃣ Chequear si ya existe empadronamiento para este año
    const existSnap = await db
      .collection("empadronamientos")
      .where("year", "==", Number(year))
      .get();

    if (!existSnap.empty) {
      return res.status(400).json({
        message: `Ya existe un empadronamiento para el año ${year}`,
      });
    }

    // 2️⃣ Crear empadronamiento en la colección de seguimiento
    const empRef = await db.collection("empadronamientos").add({
      year: Number(year),
      amount,
      status: "activo",
      createdAt: new Date(),
    });

    // 3️⃣ Crear tickets para cada jugador (solo si no existía empadronamiento)
    const jugadoresSnap = await db.collection("jugadores").get();
    const batch = db.batch();

    for (const doc of jugadoresSnap.docs) {
      const jugador = doc.data();
      const jugadorRef = db.collection("jugadores").doc(doc.id);

      if (!jugador.becado && jugador.clubId) {
        const ticketRef = db.collection("ticketsEmpadronamiento").doc();
        batch.set(ticketRef, {
  ticketId: ticketRef.id,
  empadronamientoId: empRef.id,
  year: Number(year),
  jugadorId: doc.id,
  clubId: jugador.clubId, // siempre tiene clubId
  nombre: jugador.nombre, // AGREGAR nombre
  apellido: jugador.apellido, // AGREGAR apellido
  amount,
  status: "pendiente",
  becado: false,
  createdAt: new Date(),
  updatedAt: new Date(),
        });

        batch.update(jugadorRef, { habilitadoAsambal: false });
      } else {
        batch.update(jugadorRef, { habilitadoAsambal: true });
      }
    }

    await batch.commit();

    res.status(201).json({
      message: "Empadronamiento creado correctamente",
      empadronamientoId: empRef.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear empadronamiento" });
  }
};


//FUNCION PARA CREAR MEMBRESIA ASAMBAL
const createMembresia = async (req, res) => {
  try {
    const { year, amount } = req.body;

    if (!year || !amount) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    // Crear membresia
    const membresiaRef = await db.collection("membresias").add({
      year,
      amount,
      status: "activo",
      createdAt: new Date(),
    });

    const clubesSnap = await db.collection("clubes").get();

    const batch = db.batch();

    for (const doc of clubesSnap.docs) {
      const club = doc.data();
      const clubRef = db.collection("clubes").doc(doc.id);

      if (club.becado) {
        // Becado → habilitado directo
        batch.update(clubRef, {
          habilitadoAsambal: true,
        });
      } else {
        // No becado → crear ticket en RAÍZ
        const ticketMembresiaRef = db.collection("ticketsMembresias").doc(); // <-- raíz

        batch.set(ticketMembresiaRef, {
          ticketId: ticketMembresiaRef.id,           // id del ticket
          membresiaId: membresiaRef.id, // referencia a la membresia
          year,
          clubId: doc.id,
          nombre: club.nombre,
          email: club.email,
          amount,
          status: "pendiente",
          becado: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        batch.update(clubRef, {
          habilitadoAsambal: false,
        });
      }
    }

    await batch.commit();

    res.status(201).json({
      message: "Membresia creada correctamente",
      membresiaId: membresiaRef.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear membresia" });
  }
};

const getAllTicketsEmpadronamiento = async (req, res) => {
  try {
    const snap = await db
      .collection("ticketsEmpadronamiento")
      .orderBy("createdAt", "desc")
      .get();

    const tickets = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener tickets" });
  }
};

//FUNCION PARA OBTENER AÑOS DE SEGUROS
const getSeguroYears = async (req, res) => {
  try {
    const snapshot = await db.collection("seguros").get();

    const years = [
      ...new Set(snapshot.docs.map((doc) => doc.data().year)),
    ].sort((a, b) => a - b);

    res.status(200).json(years);
  } catch (error) {
    console.error("getSeguroYears:", error);
    res.status(500).json({ message: "Error obteniendo años de seguros" });
  }
};

//FUNCION PARA OBTENER SEGUROS POR AÑO
const getSegurosByYear = async (req, res) => {
  try {
    const year = Number(req.query.year);

    if (!year) {
      return res.status(400).json({ message: "Año requerido" });
    }

    const segurosSnap = await db
      .collection("seguroProfesores")
      .where("year", "==", year)
      .get();

    if (segurosSnap.empty) {
      return res.json([]);
    }

    const result = segurosSnap.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        year: data.year,
        profesorId: data.profesorId,
        nombre: data.nombre,
        apellido: data.apellido,
        amount: data.amount,
        status: data.status,
        paidAt: data.paidAt,
      };
    });

    res.json(result);

  } catch (error) {
    console.error("getSegurosByYear:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};


//FUNCION PARA CREAR SEGURO ANUAL
const createSeguro = async (req, res) => {
  const { year, amount } = req.body;

  try {
    const yearNumber = Number(year);
    const amountNumber = Number(amount);

    const seguroRef = db.collection("seguros").doc(String(yearNumber));

    const existing = await seguroRef.get();
    if (existing.exists) {
      return res.status(400).json({
        message: "El seguro para este año ya existe",
      });
    }

    // Crear documento del año
    await seguroRef.set({
      year: yearNumber,
      baseAmount: amountNumber,
      createdAt: new Date(),
    });

    const profesoresSnap = await db.collection("profesores").get();

    let batch = db.batch();
    let operationCount = 0;

    for (const doc of profesoresSnap.docs) {
      const profesor = doc.data();

      const seguroProfesorRef = db.collection("seguroProfesores").doc();

      batch.set(seguroProfesorRef, {
        year: yearNumber,
        profesorId: doc.id,
        nombre: profesor.nombre || "",
        apellido: profesor.apellido || "",
        amount: amountNumber,
        status: "inactivo",
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      operationCount++;

      if (operationCount === 500) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    res.status(201).json({
      message: "Seguro anual creado correctamente",
      year: yearNumber,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error creando seguro anual",
    });
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
  createEmpadronamiento,
  createMembresia,
  getSeguroYears,
  getSegurosByYear,
  createSeguro,
  getAllTicketsEmpadronamiento};