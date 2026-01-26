
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

    console.log("req.user.id:", req.user.id);
    console.log("clubId recibido:", clubId);

    // --- 2. Validar que el profesor tiene el club seleccionado ---
    let profesorClubIds = req.user.clubIds || [];

    // Si es profesor y no tiene clubIds en token, lo buscamos en Firestore
    if (req.user.roles.includes("profesor") && profesorClubIds.length === 0) {
      const profSnap = await db.collection("profesores").where("userId", "==", req.user.id).limit(1).get();
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
            message: "El jugador pertenece a otro club. Desea iniciar solicitud de pase?",
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
    if (req.user.clubs) {
      const club = req.user.clubs.find(c => c.clubId === clubId);
      nombreClub = club?.nombreClub || nombreClub;
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
      });

      tx.set(jugadorRef, {
        nombre,
        apellido,
        email,
        userId: userRef.id,
        status: "INCOMPLETO",
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
    const { playerId } = req.params;
    const { activationToken, form, tutor } = req.body;

    if (!playerId || !activationToken || !form) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // 1️⃣ Usuario
    const userRef = db.collection("usuarios").doc(playerId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = userSnap.data();

    // 2️⃣ Token
    if (userData.activationToken !== activationToken) {
      return res.status(401).json({ message: "Token inválido o expirado" });
    }

    // 3️⃣ Crear Auth (sin sesión)
    const password = req.body.password || "temporal123";
    await createAuthUserIfNotExists(userData.email, password);

    const now = new Date();

    // 4️⃣ Roles usuario
    const updatedRoles = Array.isArray(userData.roles)
      ? userData.roles
      : Object.values(userData.roles || {});

    if (!updatedRoles.includes("jugador")) {
      updatedRoles.push("jugador");
    }

    await userRef.update({
      status: "PENDIENTE",
      roles: updatedRoles,
      updatedAt: now,
    });

    // 5️⃣ Obtener jugador EXISTENTE (creado por profesor)
    const jugadorRef = db.collection("jugadores").doc(playerId);
    const jugadorSnap = await jugadorRef.get();

    if (!jugadorSnap.exists) {
      return res.status(400).json({
        message: "El jugador no fue creado previamente por un profesor",
      });
    }

    const jugadorData = jugadorSnap.data();

    if (!jugadorData.clubs || !jugadorData.clubs.length) {
      return res.status(400).json({
        message: "El jugador no tiene club asignado",
      });
    }

    // 6️⃣ Actualizar jugador (club INTACTO)
    await jugadorRef.set(
      {
        email: userData.email,
        status: "INCOMPLETO",

        // 👇 datos planos
        ...form,

        tutor: tutor || null,
        updatedAt: now,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      message: "Perfil completado, pendiente de validación",
    });
  } catch (err) {
    console.error("❌ ERROR completePlayerProfile:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
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
  validatePlayer,
  getMyPlayerProfile,
  updateMyPlayerProfile,
};
