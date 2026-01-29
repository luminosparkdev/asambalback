
const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");
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

// GENERAMOS TOKEN
const generateActivationToken = () => crypto.randomBytes(20).toString("hex");

// CREAR JUGADOR y USUARIO JUGADOR
const createPlayer = async (req, res) => {
  try {
    const { nombre, apellido, email, clubId, categorias } = req.body;

    // --- 1. Validaciones básicas ---
    if (!nombre?.trim() || !apellido?.trim() || !email?.trim() || !clubId || !Array.isArray(categorias) || categorias.length === 0) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const coachId = req.user.id;

    console.log("req.user.id (coachId):", coachId);
    console.log("clubId recibido:", clubId);

    // --- 2. Validar que el profesor tiene el club seleccionado ---
    let profesorClubIds = req.user.clubIds || [];

    // Si es profesor y no tiene clubIds en token, lo buscamos en Firestore
    if (req.user.roles.includes("profesor") && profesorClubIds.length === 0) {
      const profSnap = await db.collection("profesores").where("userId", "==", coachId).limit(1).get();
      if (!profSnap.empty) {
        const profData = profSnap.docs[0].data();
        profesorClubIds = profData.clubs?.map(c => c.clubId) || [];
      }
    }

    if (!profesorClubIds.includes(clubId)) {
      return res.status(400).json({ message: "No tiene permisos sobre el club seleccionado" });
    }

    // --- 3. Buscar usuario existente ---
    const userSnap = await db.collection("usuarios").where("email", "==", email).limit(1).get();

    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();
      const rolesArray = Array.isArray(userData.roles) ? userData.roles : Object.values(userData.roles || {});

      // --- 3a. Usuario admin → error ---
      if (rolesArray.includes("admin_club") || rolesArray.includes("admin_asambal")) {
        return res.status(400).json({
          message: "No se pudo cargar al jugador por validación de roles previos",
        });
      }

      // --- 3b. Usuario profesor existente ---
      if (rolesArray.includes("profesor")) {
        return res.status(200).json({
          code: "PROFESOR_EXISTENTE",
          message: "El usuario ya existe como profesor, ¿desea agregarlo como jugador?",
          userId: userDoc.id,
        });
      }

      // --- 3c. Usuario jugador existente ---
      if (rolesArray.includes("jugador")) {
        const jugadorSnap = await db.collection("jugadores").doc(userDoc.id).get();
        const jugadorData = jugadorSnap.data();

        // Buscar si el jugador ya tiene el club seleccionado
        const clubExistente = jugadorData.clubs.find(c => c.clubId === clubId);

        if (!clubExistente) {
          // El jugador existe pero no tiene el club seleccionado
          return res.status(200).json({
            code: "JUGADOR_EXISTENTE_OTRO_CLUB",
            message: "El jugador pertenece a otro club. ¿Desea iniciar solicitud de pase?",
            userId: userDoc.id,
          });
        } else {
          // El jugador tiene el club seleccionado, verificamos categorías
          const categoriasNuevas = categorias.filter(c => !clubExistente.categorias.includes(c));
          if (categoriasNuevas.length === 0) {
            return res.status(400).json({
              message: "El jugador ya fue cargado con las mismas categorías",
            });
          } else {
            return res.status(200).json({
              code: "AGREGAR_CATEGORIAS",
              message: `Desea agregar las categorías: ${categoriasNuevas.join(", ")} al jugador?`,
              categorias: categoriasNuevas,
              userId: userDoc.id,
            });
          }
        }
      }
    }

    // --- 4. Usuario no existe → crear documentos ---
    const activationToken = generateActivationToken();
    const userRef = db.collection("usuarios").doc();
    const jugadorRef = db.collection("jugadores").doc(userRef.id);
    const now = new Date();

    // Buscar nombre del club desde profesor o admin
    let nombreClub = "Nombre del club";
    if (req.user.roles.includes("profesor")) {
      const profSnap = await db
        .collection("profesores")
        .where("userId", "==", coachId)
        .limit(1)
        .get();

      if (!profSnap.empty) {
        const profData = profSnap.docs[0].data();
        const club = profData.clubs?.find((c) => c.clubId === clubId);
        nombreClub = club?.nombreClub || club?.nombre || nombreClub;
      }
    }

    await db.runTransaction(async (tx) => {
      tx.set(userRef, {
        email,
        roles: ["jugador"],
        status: "INCOMPLETO",
        activationToken,
        createdBy: req.user.email,
        createdAt: now,
        updatedAt: now,
        clubs: [
          {
            clubId,
            nombreClub,
            categorias,
            status: "INCOMPLETO",
            updatedAt: now,
          }
        ]
      });

      tx.set(jugadorRef, {
        nombre,
        apellido,
        email,
        userId: userRef.id,
        coachId, // <-- aquí asignamos coachId plano para facilitar consultas
        status: "INCOMPLETO",
        habilitadoAsambal: false,
        becado: false,
        createdAt: now,
        updatedAt: now,
        clubs: [
          {
            clubId,
            nombreClub,
            categorias,
            status: "INCOMPLETO",
            updatedAt: now,
          }
        ]
      });
    });

    // --- 5. Enviar mail de activación ---
    await sendActivationEmail(email, activationToken, email);

    // --- 6. Responder al front ---
    res.json({ success: true, userId: userRef.id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const getPlayersByCoach = async (req, res) => {
  const coachId = req.user.id;

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
    const { playerId } = req.params;
    const { activationToken, form, tutor, clubId, nombreClub, categorias } = req.body;

    // --- 1️⃣ Validaciones ---
    if (!playerId || !activationToken || !form || !clubId || !categorias || categorias.length === 0) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const userRef = db.collection("usuarios").doc(playerId);
    const playerRef = db.collection("jugadores").doc(playerId);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const playerSnap = await tx.get(playerRef);

      if (!userSnap.exists) throw new Error("Usuario no encontrado");
      if (!playerSnap.exists) throw new Error("Jugador no encontrado");

      const userData = userSnap.data();
      const playerData = playerSnap.data();

      if (userData.activationToken !== activationToken) {
        throw new Error("Token inválido o expirado");
      }

      const now = new Date();

      // --- Roles usuario ---
      const updatedRoles = Array.isArray(userData.roles)
        ? userData.roles
        : Object.values(userData.roles || {});
      if (!updatedRoles.includes("jugador")) updatedRoles.push("jugador");

      // --- 2️⃣ Actualizar usuario ---
      // Mantenemos los clubs existentes y agregamos o actualizamos el nuevo club
      let updatedUserClubs = userData.clubs || [];
      const existingClubIndex = updatedUserClubs.findIndex(c => c.clubId === clubId);

      if (existingClubIndex >= 0) {
        // Actualizamos club existente
        updatedUserClubs[existingClubIndex] = {
          ...updatedUserClubs[existingClubIndex],
          categorias,
          nombreClub,
          status: "PENDIENTE",
          updatedAt: now,
        };
      } else {
        // Agregamos nuevo club
        updatedUserClubs.push({
          clubId,
          nombreClub,
          categorias,
          status: "PENDIENTE",
          updatedAt: now,
        });
      }

      tx.update(userRef, {
        status: "PENDIENTE",
        roles: updatedRoles,
        updatedAt: now,
        activationToken: null,
        clubs: updatedUserClubs,
      });

      // --- 3️⃣ Actualizar jugador ---
      let updatedPlayerClubs = playerData.clubs || [];
      const existingPlayerClubIndex = updatedPlayerClubs.findIndex(c => c.clubId === clubId);

      if (existingPlayerClubIndex >= 0) {
        updatedPlayerClubs[existingPlayerClubIndex] = {
          ...updatedPlayerClubs[existingPlayerClubIndex],
          categorias,
          nombreClub,
          status: "PENDIENTE",
          updatedAt: now,
        };
      } else {
        updatedPlayerClubs.push({
          clubId,
          nombreClub,
          categorias,
          status: "PENDIENTE",
          updatedAt: now,
        });
      }

      tx.update(playerRef, {
        ...form, // merge del formulario
        tutor: tutor || null,
        status: "PENDIENTE",
        clubs: updatedPlayerClubs,
        updatedAt: now,
      });
    });

    return res.json({
      success: true,
      message: "Perfil completado, pendiente de validación",
    });
  } catch (err) {
    console.error("❌ ERROR completePlayerProfile:", err);
    return res.status(500).json({ message: err.message });
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

// TRANSFERENCIAS DE JUGADORES

// CLUB SOLICITA PASE
const sendTransferRequest = async (req, res) => {
  try {
    const activeClub = req.user.clubs?.[0];
    const { playerId } = req.body;

    if (!activeClub) {
      return res.status(400).json({ message: "Usuario sin club activo" });
    }

    const playerSnap = await db.collection("jugadores").doc(playerId).get();
    if (!playerSnap.exists) {
      return res.status(404).json({ message: "Jugador no encontrado" });
    }

    const playerData = playerSnap.data();

    // Si ya es del club
    if (playerData.clubId === activeClub.clubId) {
      return res.status(400).json({ message: "El jugador ya pertenece al club" });
    }

    // Validar que no exista request pendiente
    const existing = await db
      .collection("transferRequests")
      .where("playerId", "==", playerId)
      .where("status", "==", "PENDIENTE_ASAMBAL")
      .get();

    if (!existing.empty) {
      return res.status(400).json({ message: "Ya existe una solicitud pendiente" });
    }

    await db.collection("transferRequests").add({
      playerId,
      fromClubId: playerData.clubId,
      toClubId: activeClub.clubId,
      categorias: playerData.categorias || [],
      status: "PENDIENTE_ASAMBAL",
      createdAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN ASAMBAL APRUEBA PASE
const getMyTransferRequests = async (req, res) => {
  try {
    const activeClub = req.user.clubs?.[0];

    if (!activeClub) {
      return res.status(400).json({ message: "Usuario sin club activo" });
    }

    const snap = await db
      .collection("transferRequests")
      .where("toClubId", "==", activeClub.clubId)
      .where("status", "==", "PENDIENTE_ASAMBAL")
      .get();

    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// JUGADOR ACEPTA PASE
const respondTransferRequest = async (req, res) => {
  try {
    const { action } = req.body;
    const requestRef = db.collection("transferRequests").doc(req.params.id);

    if (!["ACCEPT", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) throw new Error("Solicitud no encontrada");

      const data = snap.data();
      if (data.status !== "PENDIENTE_ASAMBAL") {
        throw new Error("Solicitud ya procesada");
      }

      if (action === "ACCEPT") {
        const playerRef = db.collection("jugadores").doc(data.playerId);
        tx.update(playerRef, {
          clubId: data.toClubId,
          updatedAt: new Date(),
        });
      }

      tx.update(requestRef, {
        status: action === "ACCEPT" ? "ACEPTADA" : "RECHAZADA",
        respondedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createPlayer,
  getPlayersByCoach,
  getPlayerById,
  updatePlayer,
  togglePlayerStatus,
  completePlayerProfile,
  validatePlayer,
  getMyPlayerProfile,
  updateMyPlayerProfile,
  // TRANSFERENCIAS DE JUGADORES
  sendTransferRequest,
  getMyTransferRequests,
  respondTransferRequest,
};
