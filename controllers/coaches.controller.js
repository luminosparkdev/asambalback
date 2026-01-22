
const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAR PROFESOR y USUARIO PROFESOR
const createProfesor = async (req, res) => {
  try {
    const { nombre, apellido, email, categorias } = req.body;

    if (
      !nombre?.trim() ||
      !apellido?.trim() ||
      !email?.trim() ||
      !Array.isArray(categorias) ||
      categorias.length === 0
    ) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const existing = await db
      .collection("profesores")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0];
      return res.status(200).json({
        code: "PROFESOR_EXISTENTE",
        profesorId: doc.id,
        message: "El profesor ya existe en el sistema",
      });
    }

    const activationToken = generateActivationToken();

    const userRef = db.collection("usuarios").doc();
    const coachRef = db.collection("profesores").doc(userRef.id);

    const now = new Date();

    await db.runTransaction(async (tx) => {
      tx.set(userRef, {
        email,
        roles: ["profesor"],
        status: "INCOMPLETO",
        activationToken,
        createdBy: req.user.email,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(coachRef, {
        nombre,
        apellido,
        email,
        userId: userRef.id,
        clubs: [
          {
            clubId: req.user.clubId,
            nombreClub: req.user.nombreClub,
            categorias,
            status: "INCOMPLETO",
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
    });

    await sendActivationEmail(email, activationToken, email);

    res.json({ success: true, id: userRef.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// SOLICITAR UNIRSE A UN CLUB
const requestJoinCoach = async (req, res) => {
  try {
    const { email, categorias } = req.body;
    const { clubId, nombreClub } = req.user;

    if (!email || !Array.isArray(categorias) || categorias.length === 0) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    const coachSnap = await db
      .collection("profesores")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (coachSnap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachDoc = coachSnap.docs[0];
    const coachData = coachDoc.data();

    // ¿Ya pertenece al club?
    const alreadyInClub = coachData.clubs?.some(
      (c) => c.clubId === clubId
    );

    if (alreadyInClub) {
      return res.status(400).json({
        message: "El profesor ya pertenece a este club",
      });
    }

    // ¿Ya hay solicitud pendiente?
    const existingRequest = await db
      .collection("coachRequests")
      .where("profesorId", "==", coachDoc.id)
      .where("clubId", "==", clubId)
      .where("status", "==", "PENDIENTE")
      .get();

    if (!existingRequest.empty) {
      return res.status(400).json({
        message: "Ya existe una solicitud pendiente",
      });
    }

    await db.collection("coachRequests").add({
      profesorId: coachDoc.id,
      emailProfesor: email,
      clubId,
      nombreClub,
      categorias,
      status: "PENDIENTE",
      createdAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//SOLICITUDES PENDIENTES PARA EL PROFESOR
const getMyCoachRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const coachSnap = await db
      .collection("profesores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (coachSnap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachId = coachSnap.docs[0].id;

    const snap = await db
      .collection("coachRequests")
      .where("profesorId", "==", coachId)
      .where("status", "==", "PENDIENTE")
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

//RESPONDER SOLICITUD DE UNIRSE A UN CLUB
const respondCoachRequest = async (req, res) => {
  try {
    const { action } = req.body;
    const requestRef = db.collection("coachRequests").doc(req.params.id);

    if (!["ACCEPT", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) throw new Error("Solicitud no encontrada");

      const reqData = snap.data();
      if (reqData.status !== "PENDIENTE") {
        throw new Error("Solicitud ya procesada");
      }

      if (action === "ACCEPT") {
        const coachRef = db.collection("profesores").doc(reqData.profesorId);
        const coachSnap = await tx.get(coachRef);

        const clubs = coachSnap.data().clubs || [];

        clubs.push({
          clubId: reqData.clubId,
          nombreClub: reqData.nombreClub,
          categorias: reqData.categorias,
          status: "ACTIVO",
        });

        tx.update(coachRef, {
          clubs,
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


// LISTAR PROFESORES DEL CLUB
const getProfesores = async (req, res) => {
  try {
    const clubId = req.user.clubId;

    if (!clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const snap = await db.collection("profesores").get();

    const profesores = snap.docs
      .map(doc => {
        const data = doc.data();

        const clubData = data.clubs?.find(
          c => c.clubId === clubId
        );

        if (!clubData) return null;

        return {
          id: doc.id,
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          telefono: data.telefono,
          dni: data.dni,
          enea: data.enea,

          // 🔑 datos del club
          status: clubData.status,
          categorias: clubData.categorias,
        };
      })
      .filter(Boolean);

    res.json(profesores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const formatTimestamp = (ts) => {
  if (!ts || !ts.toDate) return null;
  return ts
    .toDate()
    .toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
};

// OBTENER PROFESOR POR ID
const getProfesorById = async (req, res) => {
  try {
    const { id } = req.params;
    const clubId = req.user.clubId;

    const doc = await db.collection("profesores").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const data = doc.data();
    const club = data.clubs?.find(c => c.clubId === clubId);

    if (!club) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    res.json({
      id: doc.id,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      telefono: data.telefono,
      domicilio: data.domicilio,
      enea: data.enea,
      dni: data.dni,

      // datos dependientes del club
      status: club.status,
      categorias: club.categorias,

      createdAt: formatTimestamp(data.createdAt),
      updatedAt: formatTimestamp(data.updatedAt),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// EDITAR PROFESOR
const updateProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const clubId = req.user.clubId;
    const { categorias } = req.body;

    if (!categorias) {
      return res.status(400).json({ message: "No hay datos para actualizar" });
    }

    const ref = db.collection("profesores").doc(id);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        throw new Error("Profesor no encontrado");
      }

      const data = snap.data();
      const clubs = data.clubs || [];

      const clubIndex = clubs.findIndex(c => c.clubId === clubId);
      if (clubIndex === -1) {
        throw new Error("Acceso denegado");
      }

      clubs[clubIndex] = {
        ...clubs[clubIndex],
        categorias,
        updatedAt: new Date(),
      };

      tx.update(ref, {
        clubs,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// TOGGLE ACTIVO / INACTIVO
const toggleProfesorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const clubId = req.user.clubId;

    const coachRef = db.collection("profesores").doc(id);

    let newStatus = null;

    await db.runTransaction(async (tx) => {
      const coachSnap = await tx.get(coachRef);

      if (!coachSnap.exists) {
        throw new Error("Profesor no encontrado");
      }

      const data = coachSnap.data();
      const clubs = data.clubs || [];

      const clubIndex = clubs.findIndex(c => c.clubId === clubId);

      if (clubIndex === -1) {
        throw new Error("El profesor no pertenece a este club");
      }

      const currentStatus = clubs[clubIndex].status;

      if (!["ACTIVO", "INACTIVO"].includes(currentStatus)) {
        throw new Error(
          `No se puede cambiar el estado del profesor desde ${currentStatus}`
        );
      }

      newStatus = currentStatus === "ACTIVO" ? "INACTIVO" : "ACTIVO";

      clubs[clubIndex] = {
        ...clubs[clubIndex],
        status: newStatus,
      };

      tx.update(coachRef, {
        clubs,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const completeProfesorProfile = async (req, res) => {
  const { activationToken, telefono, domicilio, enea, dni } = req.body;

  const userSnap = await db
    .collection("usuarios")
    .where("activationToken", "==", activationToken)
    .limit(1)
    .get();

  if (userSnap.empty) {
    return res.status(403).json({ message: "Token inválido" });
  }

  if (!activationToken) {
    return res.status(400).json({ message: "Falta token de activación" });
  }

  const userRef = userSnap.docs[0].ref;
  const userId = userRef.id;
  const coachRef = db.collection("profesores").doc(userId);

  await db.runTransaction(async (tx) => {
    tx.update(userRef, {
      status: "PENDIENTE",
      activationToken: null,
      updatedAt: new Date(),
    });

    tx.update(coachRef, {
      telefono,
      domicilio,
      enea,
      dni,
      status: "PENDIENTE",
      updatedAt: new Date(),
    });
  });

  res.json({ success: true });
};

const getCoachPrefillByToken = async (req, res) => {
  const { activationToken } = req.params;

  if (!activationToken) {
    return res.status(400).json({ message: "Falta token" });
  }

  // 1️⃣ Buscar usuario por token
  const userSnap = await db
    .collection("usuarios")
    .where("activationToken", "==", activationToken)
    .limit(1)
    .get();

  if (userSnap.empty) {
    return res.status(404).json({ message: "Token inválido" });
  }

  const userId = userSnap.docs[0].id;

  // 2️⃣ Traer perfil del profesor
  const coachSnap = await db.collection("profesores").doc(userId).get();

  if (!coachSnap.exists) {
    return res.status(404).json({ message: "Profesor no encontrado" });
  }

  const coachData = coachSnap.data();

  // 3️⃣ RESPUESTA → TODO desde profesores
  return res.json({
    nombre: coachData.nombre || "",
    apellido: coachData.apellido || "",
    email: coachData.email || "",
    categorias:
      coachData.clubs?.flatMap((c) => c.categorias) || [],
  });
};

const validateCoach = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { action, clubId } = req.body;

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    if (!clubId) {
      return res.status(400).json({ message: "ClubId requerido" });
    }

    const coachRef = db.collection("profesores").doc(coachId);
    const coachSnap = await coachRef.get();

    if (!coachSnap.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachData = coachSnap.data();

    const clubIndex = coachData.clubs?.findIndex(
      (c) => c.clubId === clubId
    );

    if (clubIndex === -1) {
      return res.status(400).json({
        message: "El profesor no pertenece a este club",
      });
    }

    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    const updatedClubs = [...coachData.clubs];
    updatedClubs[clubIndex] = {
      ...updatedClubs[clubIndex],
      status: newStatus,
    };

    const userRef = db.collection("usuarios").doc(coachData.userId);

    await db.runTransaction(async (tx) => {
      tx.update(coachRef, {
        clubs: updatedClubs,
        updatedAt: new Date(),
      });

      if (action === "APPROVE") {
        tx.update(userRef, {
          status: "ACTIVO",
          updatedAt: new Date(),
        });
      }
    });

    res.json({
      success: true,
      clubStatus: newStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const snap = await db
      .collection("profesores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const doc = snap.docs[0];
    res.json({ id: doc.id, ...doc.data(),
     });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMyCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { enea } = req.body;

    const snap = await db
      .collection("profesores")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachRef = snap.docs[0].ref;

    await coachRef.update({
      enea,
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Profesores aprueban/rechazan jugadores de su club
const validatePlayersInClub = async (req, res) => {
  try {
    const { userId, action } = req.body; // action = "APPROVE" | "REJECT"
    const profesorClubId = req.user.clubId;

    // Buscamos usuario jugador
    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ message: "Usuario no encontrado" });

    const userData = userSnap.data();

    if (!userData.roles?.jugador) return res.status(400).json({ message: "Usuario no tiene rol jugador" });

    // Solo podemos actualizar estado del jugador en el club del profesor
    const jugadorRol = userData.roles.jugador.find(j => j.clubId === profesorClubId);
    if (!jugadorRol) return res.status(400).json({ message: "El jugador no pertenece a tu club" });

    const newEstado = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    // Actualizamos estado en usuarios
    const updatedRoles = { ...userData.roles };
    updatedRoles.jugador = updatedRoles.jugador.map(j => {
      if (j.clubId === profesorClubId) j.estado = newEstado;
      return j;
    });

    await userRef.update({ roles: updatedRoles, updatedAt: new Date() });

    // Actualizamos estado en colección jugadores
    const playerRef = db.collection("jugadores").doc(userId);
    await playerRef.update({
      estado: newEstado,
      updatedAt: new Date(),
    });

    res.json({ success: true, estado: newEstado });
  } catch (err) {
    console.error("❌ ERROR validatePlayersInClub (Profesor):", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProfesor,
  requestJoinCoach,
  getMyCoachRequests,
  respondCoachRequest,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
  completeProfesorProfile,
  getCoachPrefillByToken,
  validateCoach,
  getMyCoachProfile,
  updateMyCoachProfile,
  validatePlayersInClub,
};
