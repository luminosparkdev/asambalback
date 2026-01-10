const { db } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../utils/token");

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userSnap = await db.collection("usuarios").where("email", "==", email).get();

    if (userSnap.empty) return res.status(400).json({ message: "Usuario no encontrado" });

    const userData = userSnap.docs[0].data();

    if (userData.status !== "ACTIVO") {
      return res.status(400).json({
        message: "Usuario no activo",
        status: userData.status,
      });
    }
    const isMatch = bcrypt.compareSync(password, userData.password);
    if (!isMatch) return res.status(400).json({ message: "Contraseña incorrecta" });

    const token = generateToken({ email: userData.email, role: userData.role, clubId: userData.clubId || null });

    res.json({ user: { email: userData.email, role: userData.role, clubId: userData.clubId || null }, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ACTIVACION DE CUENTA
const activateAccount = async (req, res) => {
  console.log("👉 REQ BODY:", req.body); // 👈 ACÁ

  try {
    const { email, password, token } = req.body;

    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", email)
      .get();

    if (userSnap.empty) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.activationToken !== token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const newStatus =
      userData.role === "admin_asambal" ? "ACTIVO" : "PENDIENTE";

    await userDoc.ref.update({
      password: hashedPassword,
      status: newStatus,
      activationToken: null,
      updatedAt: new Date(),
    });

    res.json({ success: true, newStatus });
  } catch (err) {
    console.error("❌ ERROR activateAccount:", err);
    res.status(500).json({ message: err.message });
  }
};



module.exports = { login, activateAccount };
