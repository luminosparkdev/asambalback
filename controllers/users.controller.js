const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");

//GENERAMOS TOKEN
const generateActivationToken = () => crypto.randomBytes(20).toString("hex");

//CREAMOS USUARIO
const createUser = async (req, res) => {

  const allowedRoleCreation = {
    admin_asambal: ["admin_club"],
    admin_club: ["profesor"],
    profesor: ["jugador"],
  };

  const creatorRole = req.user.role;
  const { role: newUserRole } = req.body;

  if (
    !allowedRoleCreation[creatorRole] ||
    !allowedRoleCreation[creatorRole].includes(newUserRole)
  ) {
    return res.status(403).json({
      message: "No tenés permisos para crear este tipo de usuario",
    });
  }

  try {
    const { email, role } = req.body;

    if (!email || !role) return res.status(400).json({ message: "Faltan datos" });

    //VERIFICAMOS SI YA EXISTE
    const existing = await db.collection("usuarios").where("email", "==", email).get();
    if (!existing.empty) return res.status(400).json({ message: "Usuario ya existe" });

    const activationToken = generateActivationToken();

    //ASIGNAMOS CLUBID

    let clubId = null;

    if (creatorRole === "admin_asambal") {
      clubId = req.body.clubId;
      if (!clubId) {
        return res.status(400).json({
          message: "El clubId es obligatorio para este tipo de usuario",
        });
      }
    }

    if (creatorRole === "admin_club" || creatorRole === "profesor") {
      clubId = req.user.clubId;
      if (!clubId) {
        return res.status(400).json({
          message: "El usuario creador no tiene club asignado",
        });
      }
    }


    //GUARDAMOS USUARIO
    await db.collection("usuarios").doc().set({
      email,
      role,
      active: false,
      password: "",
      activationToken,
      createdBy: req.user?.email || "LuminoSpark",
      clubId: req.user?.clubId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ENVIO DE MAIL
    await sendActivationEmail(email, activationToken, email);

    res.json({ success: true, message: "Usuario creado correctamente y mail enviado" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createUser };
