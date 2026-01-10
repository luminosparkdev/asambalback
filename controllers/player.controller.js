const { db } = require("../config/firebase");

const createPlayer = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      sexo,
      fechaNacimiento,
      edad,
      dni,
      email,
      telefono,
      domicilio,
      categoria,
    } = req.body;

    if (!nombre || !apellido || !dni || !email || !telefono || !domicilio || !categoria || !sexo || !fechaNacimiento || !edad) {
      return res.status(400).json({ message: "Faltan datos" });
    }

    const ref = db.collection("jugadores").doc();

    await ref.set({
      nombre,
      apellido,
      sexo,
      fechaNacimiento,
      edad,
      dni,
      email,
      telefono,
      domicilio,
      categoria,

      clubId: req.user.clubId,
      coachId: req.user.role === "profesor" ? req.user.id : null,

      isActive: true,
      isAuthorized: false,
      imageAuthorization: false,

      createdBy: req.user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ success: true, id: ref.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
