const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

// GENERAMOS TOKEN
const generateActivationToken = () =>
  crypto.randomBytes(20).toString("hex");

// CREAR PROFESOR y USUARIO PROFESOR
const createProfesor = async (req, res) => {
  try {
    const { nombre, apellido, email, categoria } = req.body;

    if (!nombre || !apellido || !email || !categoria) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    // CHEQUEAMOS USUARIO EXISTENTE
    const existing = await db
      .collection("profesores")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ message: "El profesor ya existe" });
    }

    const activationToken = generateActivationToken();

    const userRef = db.collection("usuarios").doc();
    const coachRef = db.collection("profesores").doc(userRef.id);

    await db.runTransaction(async (tx) =>{
        //USUARIO
        tx.set(userRef, {
            email,
            role: "profesor",
            clubId: req.user.clubId,
            status: "INCOMPLETO",
            activationToken,
            createdBy: req.user.email,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        //PERFIL PROFESOR
        tx.set(coachRef, {
            nombre,
            apellido,
            email,
            categoria,
            clubId: req.user.clubId,
            userId: userRef.id,
            status: "INCOMPLETO",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    });

    await sendActivationEmail(email, activationToken, email);

    res.json({ success: true, id: userRef.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LISTAR PROFESORES DEL CLUB
const getProfesores = async (req, res) => {
  try {
    const snapshot = await db
      .collection("profesores")
      .where("clubId", "==", req.user.clubId)
      .get();

    const profesores = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (!req.user.clubId) {
      return res.status(400).json({ message: "Usuario sin club asignado" });
    }

    res.json(profesores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// OBTENER PROFESOR POR ID
const getProfesorById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("profesores").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    if (doc.data().clubId !== req.user.clubId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// EDITAR PROFESOR
const updateProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, enea, status } = req.body;

    const ref = db.collection("profesores").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    if (snap.data().clubId !== req.user.clubId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    await ref.update({
      nombre,
      apellido,
      email,
      enea,
      status,
      updatedAt: new Date(),
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

    const coachRef = db.collection("profesores").doc(id);

    let newStatus = null;

    await db.runTransaction(async (tx) => {
      const coachSnap = await tx.get(coachRef);

      if (!coachSnap.exists) {
        throw new Error("Profesor no encontrado");
      }

      const currentStatus = coachSnap.data().status;

      if (!["ACTIVO", "INACTIVO"].includes(currentStatus)) {
        throw new Error(`No se puede cambiar el estado del profesor desde ${currentStatus}`);
      }

      newStatus = currentStatus === "ACTIVO" ? "INACTIVO" : "ACTIVO";

      tx.update(coachRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      if (newStatus === "INACTIVO") {
      const userSnap = await db
      .collection("usuarios")
      .where("coachId", "==", id)
      .where("status", "==", "ACTIVO")
      .get();

      userSnap.docs.forEach(doc => {
        tx.update(doc.ref, {
          status: "INACTIVO",
          updatedAt: new Date(),
        });
      });
      }
    });    

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const completeProfesorProfile = async (req, res) => {
  try {
    const {
      telefono,
      domicilio,
      enea,
    } = req.body;

    const userId = req.user.id;

    const snap = await db
    .collection("profesores")
    .where("userId", "==", userId)
    .limit(1)
    .get();

    if (snap.empty) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachDoc = snap.docs[0];
    const coachRef = coachDoc.ref;

    if (coachDoc.data().clubId !== req.user.clubId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    await db.runTransaction(async (tx) => {
      tx.update(coachRef, {
        telefono,
        domicilio,
        enea,
        status: "PENDIENTE",
        updatedAt: new Date(),
      });

      tx.update(db.collection("usuarios").doc(userId), {
        status: "PENDIENTE",
        updatedAt: new Date(),
      });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPendingCoaches = async (req, res) => {
  try {
    const snap = await db
      .collection("profesores")
      .where("clubId", "==", req.user.clubId)
      .where("status", "==", "PENDIENTE")
      .get();

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const validateCoach = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { action } = req.body;

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "Acción inválida" });
    }

    const coachRef = db.collection("profesores").doc(coachId);
    const coachSnap = await coachRef.get();

    if (!coachSnap.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    const coachData = coachSnap.data();

    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    const userRef = db.collection("usuarios").doc(coachData.userId);
    const userSnap = await userRef.get();

    console.log("userId:", coachData.userId);
    console.log("usuario existe:", userSnap.exists)

    await db.runTransaction(async (tx) => {
      tx.update(coachRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      const userRef = db.collection("usuarios").doc(coachData.userId);

      tx.update(userRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
    });

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const doc = await db.collection("profesores").doc(userId).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


module.exports = {
  createProfesor,
  getProfesores,
  getProfesorById,
  updateProfesor,
  toggleProfesorStatus,
  completeProfesorProfile,
  getPendingCoaches,
  validateCoach,
  getMyCoachProfile,
};
