const { db } = require("../config/firebase");

// CREAR PROFESOR
const createProfesor = async (req, res) => {
  try {
    const { nombre, apellido, dni, email, telefono, domicilio, categoria, enea } = req.body;

    if (!nombre || !apellido || !dni || !email || !telefono || !domicilio || !categoria || !enea) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    // chequeo email duplicado
    const existing = await db
      .collection("profesores")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ message: "El profesor ya existe" });
    }

    const profesorRef = db.collection("profesores").doc();

    await profesorRef.set({
      nombre,
      apellido,
      dni,
      email,
      telefono,
      domicilio,
      categoria,
      enea,
      clubId: req.user.clubId,
      isActive: true,

      createdBy: req.user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ success: true, id: profesorRef.id });
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
    const { nombre, apellido, email, enea, isActive } = req.body;

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
      isActive,
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

    const ref = db.collection("profesores").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Profesor no encontrado" });
    }

    if (snap.data().clubId !== req.user.clubId) {
      return res.status(403).json({ message: "Acceso denegado" });
    }

    const newStatus = !snap.data().isActive;

    await ref.update({
      isActive: newStatus,
      updatedAt: new Date(),
    });

    res.json({ success: true, isActive: newStatus });
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
};
