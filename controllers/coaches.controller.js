
const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAR PROFESOR y USUARIO PROFESOR
const createProfesor = async (req, res) => {
  try {
    console.log("REQ.USER COMPLETO:", JSON.stringify(req.user, null, 2));
    const { nombre, apellido, email, categorias } = req.body;

    // Validación de datos
    if (
      !nombre?.trim() ||
      !apellido?.trim() ||
      !email?.trim() ||
      !Array.isArray(categorias) ||
      categorias.length === 0
    ) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const activeClub = req.user.clubs?.[0];

    if (!activeClub?.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    const { clubId, nombre: nombreClub } = activeClub;
    
    console.log("REQ.USER:", JSON.stringify(req.user, null, 2));
    console.log("ACTIVE CLUB:", activeClub);
    console.log("NOMBRE CLUB RESUELTO:", nombreClub);
    console.log("NOMBRE PROFESOR:", nombre);

    // BUSCAMOS USUARIO EXISTENTE EN "usuarios"
    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", email)
      .get();

    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();

      // Convertimos roles a array real
      const rolesArray = Array.isArray(userData.roles)
        ? userData.roles
        : Object.values(userData.roles || {});

      // 1️⃣ Usuario admin → error
      if (rolesArray.includes("admin_club") || rolesArray.includes("admin_asambal")) {
        return res.status(400).json({
          message: "No se puede crear un profesor con un email de administrador",
        });
      }

      // 2️⃣ Usuario profesor
      if (rolesArray.includes("profesor")) {
        const coachSnap = await db
          .collection("profesores")
          .where("userId", "==", userDoc.id)
          .get();

        if (!coachSnap.empty) {
          const coachData = coachSnap.docs[0].data();
          const clubIds = coachData.clubs.map(c => c.clubId);

          if (clubIds.includes(clubId)) {
            return res.status(400).json({
              message: "El profesor ya fue cargado en su club",
            });
          } else {
            return res.status(200).json({
              code: "PROFESOR_EXISTENTE",
              profesorId: coachSnap.docs[0].id,
              message: "El profesor ya existe, ¿desea enviar solicitud para agregarlo a su club?",
            });
          }
        }
      }

      // 3️⃣ Usuario jugador
      if (rolesArray.includes("jugador")) {
        if (!userData.fechaNacimiento) {
          return res.status(400).json({
            message: "No se puede determinar la edad del jugador",
          });
        }

        const birthDate = new Date(userData.fechaNacimiento);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        if (age < 18) {
          return res.status(400).json({
            message: "No se puede crear un profesor menor de 18 años",
          });
        }

        const jugadorClubId = userData.clubId || null;
        if (jugadorClubId === clubId) {
          return res.status(200).json({
            code: "JUGADOR_EXISTENTE",
            jugadorId: userDoc.id,
            message: "El usuario es jugador en su club, ¿desea agregarlo como profesor?",
          });
        } else {
          return res.status(200).json({
            code: "JUGADOR_EXISTENTE_OTRO_CLUB",
            jugadorId: userDoc.id,
            message: "El usuario es jugador en otro club, ¿desea agregarlo como profesor a su club?",
          });
        }
      }
    }

    // --- Si no hay conflictos, se crea el profesor normalmente ---
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
        clubs: [
          {
            clubId,
            nombre: nombreClub,
            categorias,
            status: "INCOMPLETO",
          },
        ],
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
            clubId,
            nombre: nombreClub,
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
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const getPendingPlayers = async (req, res) => {
  try {
    console.log("🧠 req.user =", JSON.stringify(req.user, null, 2));

    const { clubId } = req.params;

    // Leemos los clubIds del header enviado por el frontend
    const professorClubIds = JSON.parse(req.headers["x-professor-clubs"] || "[]");

    if (!clubId) {
      return res.status(400).json({ message: "Debe especificar el club" });
    }

    if (!professorClubIds.includes(clubId)) {
      return res.status(403).json({ message: "El profesor no pertenece a este club" });
    }

    const snapshot = await db
      .collection("jugadores")
      .where("status", "in", ["PENDIENTE"])
      .get();

    const pendingPlayers = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      const pendingClub = (data.clubs || []).find(
        (club) => club.clubId === clubId && club.status === "PENDIENTE"
      );

      if (pendingClub) {
        pendingPlayers.push({
          id: doc.id,
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          categorias: pendingClub.categorias || [],
        });
      }
    });

    return res.json(pendingPlayers);
  } catch (err) {
    console.error("❌ ERROR getPendingPlayers:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

const getMyClubs = async (req, res) => {
  try {
    const userId = req.user.id; 
    const coachSnap = await db.collection("profesores").where("userId", "==", userId).get();

    if (coachSnap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachData = coachSnap.docs[0].data();
    const clubs = coachData.clubs || [];

    // Retornamos clubId, nombreClub y categorias
    const simplified = clubs.map(c => ({
      clubId: c.clubId,
      nombreClub: c.nombreClub,
      categorias: c.categorias || []
    }));

    res.json(simplified);
  } catch (err) {
    console.error(err);
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
    const clubs = req.user.clubs || [];

    const clubId = Array.isArray(clubs) && clubs.length > 0
      ? clubs[0].clubId
      : null;

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
  try {
    const { activationToken, telefono, domicilio, enea, dni } = req.body;

    if (!activationToken) {
      return res.status(400).json({ message: "Falta token de activación" });
    }

    const userSnap = await db
      .collection("usuarios")
      .where("activationToken", "==", activationToken)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(403).json({ message: "Token inválido" });
    }

    const userRef = userSnap.docs[0].ref;
    const userId = userRef.id;
    const coachRef = db.collection("profesores").doc(userId);

    const coachSnap = await coachRef.get();
    if (!coachSnap.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachData = coachSnap.data();

    // 🔁 Actualizamos los estados dentro de clubs
    const updatedClubs = (coachData.clubs || []).map(club => ({
      ...club,
      status: "PENDIENTE",
      updatedAt: new Date(),
    }));

    const now = new Date();

    await db.runTransaction(async (tx) => {
      // usuarios
      tx.update(userRef, {
        status: "PENDIENTE",
        activationToken: null,
        updatedAt: now,
      });

      // profesores
      tx.update(coachRef, {
        telefono,
        domicilio,
        enea,
        dni,
        status: "PENDIENTE",
        clubs: updatedClubs,
        updatedAt: now,
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ ERROR completeProfesorProfile:", err);
    res.status(500).json({ message: err.message });
  }
};

const sendRequestJoinToCoach = async (req, res) => {
  try {
    const { email, nombre, apellido, categorias } = req.body;
    const { clubId, nombreClub } = req.user; // admin_club que envía la solicitud

    if (!email || !nombre?.trim() || !apellido?.trim() || !Array.isArray(categorias) || categorias.length === 0) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    // Buscamos al profesor por email
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

    // ✅ Validamos que el nombre y apellido coincidan
    if (coachData.nombre !== nombre.trim() || coachData.apellido !== apellido.trim()) {
      return res.status(400).json({
        message: "Los datos ingresados no coinciden con el profesor registrado",
        existingNombre: coachData.nombre,
        existingApellido: coachData.apellido,
      });
    }

    // Verificamos si ya pertenece al club
    const alreadyInClub = coachData.clubs?.some((c) => c.clubId === clubId);

    if (alreadyInClub) {
      return res.status(400).json({
        message: "El profesor ya pertenece a este club",
      });
    }

    // Verificamos si ya hay solicitud pendiente de este club
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

    // Creamos la solicitud
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
    console.error(err);
    res.status(500).json({ message: err.message });
  }
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
    const { userId, clubId, action } = req.body; // action = "APPROVE" | "REJECT"
    const profesorClubIds = req.user.clubs?.map(c => c.clubId) || [];

    if (!clubId || !profesorClubIds.includes(clubId)) {
      return res.status(403).json({ message: "No se puede validar" });
    }
    // Buscamos usuario jugador
    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ message: "Usuario no encontrado" });

    const userData = userSnap.data();

    if (!userData.roles?.jugador) return res.status(400).json({ message: "Usuario no tiene rol jugador" });
    
    const newEstado = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";
    const updateUserClub = (userData.clubs || []).map(c => { if (c.clubId === clubId) return { ...c, status: action === "APPROVE" ? "ACTIVO" : "RECHAZADO" }; return c; });

    await userRef.update({ clubs: updateUserClub, updatedAt: new Date() });

    // Actualizamos estado en colección jugadores
    const playerRef = db.collection("jugadores").doc(userId);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) return res.status(404).json({ message: "Jugador no encontrado" });

    const playerData = playerSnap.data();

    const updatePlayerClubs = (playerData.clubs || []).map(c => { if (c.clubId === clubId) return { ...c, status: newEstado, updatedAt: new Date() }; return c; });
    await playerRef.update({
      updatedAt: new Date(),
      clubs: updatePlayerClubs
    });

    res.json({ success: true, status: newEstado });
  } catch (err) {
    console.error("❌ ERROR validatePlayersInClub (Profesor):", err);
    res.status(500).json({ message: err.message });
  }
};

const getSeguros = async (req, res) => {
  try {
    const profesorId = req.user.uid; // viene del authMiddleware
    const year = req.query.year ? Number(req.query.year) : null;

    if (!profesorId) {
      return res.status(400).json({
        message: "Profesor ID no encontrado en la autenticación",
      });
    }

    let query = db
      .collection("seguroProfesores")
      .where("profesorId", "==", profesorId);

    if (year) {
      query = query.where("year", "==", year);
    }

    const segurosSnap = await query.orderBy("year", "desc").get();

    if (segurosSnap.empty) {
      return res.json([]);
    }

    const result = segurosSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        year: data.year,
        amount: data.amount,
        status: data.status,
        paidAt: data.paidAt || null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error en getSeguros:", error);
    res.status(500).json({
      message: "Error obteniendo los seguros",
      error: error.message,
    });
  }
};








const pagarSeguro = async (req, res) => {
  try {
    const { seguroId } = req.params;
    const profesorId = req.user.uid;

    const ref = db
      .collection("seguros")
      .doc(seguroId)
      .collection("profesores")
      .doc(profesorId);

    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Ticket no encontrado" });
    }

    if (snap.data().status === "activo") {
      return res.json({ message: "El seguro ya está activo" });
    }

    await ref.update({
      status: "activo",
      paidAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ message: "Seguro activado correctamente" });
  } catch (error) {
    console.error("pagarSeguro:", error);
    res.status(500).json({ message: "Error procesando pago" });
  }
};



module.exports = {
  createProfesor,
  getMyClubs,
  getPendingPlayers,
  sendRequestJoinToCoach,
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
  getSeguros,
  pagarSeguro,
};
