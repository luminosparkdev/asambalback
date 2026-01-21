const { db } = require("../config/firebase");
const crypto = require("crypto");
const { sendActivationEmail } = require("../utils/mailer");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");

// Generamos token de activación
const generateActivationToken = () => crypto.randomBytes(20).toString("hex");

// Crear usuario general (admin_club, profesor, jugador)
const createUser = async (req, res) => {
  try {
    const allowedRoleCreation = {
      admin_asambal: ["admin_club"],
      admin_club: ["profesor", "jugador"],
      profesor: ["jugador"],
    };

    const creatorRole = req.user.role; // rol del que crea
    const { role: newUserRole, clubId, categoria } = req.body;

    // Validamos permisos
    if (!allowedRoleCreation[creatorRole] || !allowedRoleCreation[creatorRole].includes(newUserRole)) {
      return res.status(403).json({ message: "No tenés permisos para crear este tipo de usuario" });
    }

    // Validamos datos obligatorios
    if (!newUserRole || (newUserRole !== "admin_club" && !clubId)) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Falta email" });

    // Verificamos si ya existe
    const existingSnap = await db.collection("usuarios").where("email", "==", email).limit(1).get();
    const activationToken = generateActivationToken();

    if (existingSnap.empty) {
      // Usuario nuevo
      const roles = {};

      if (newUserRole === "jugador") {
        roles.jugador = [{ clubId, categoria, estado: "PENDIENTE" }];
      } else if (newUserRole === "profesor") {
        roles.profesor = { clubes: [clubId], categorias: [categoria], estado: "PENDIENTE" };
      } else if (newUserRole === "admin_club") {
        roles.admin_club = { estado: "PENDIENTE" };
      }

      // Guardamos usuario
      const userRef = db.collection("usuarios").doc();
      await userRef.set({
        email,
        roles,
        status: "INCOMPLETO",
        activationToken,
        createdBy: req.user?.email || "LuminoSpark",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Creamos documento en coleccion correspondiente
      if (newUserRole === "profesor") {
        await db.collection("profesores").doc(userRef.id).set({
          email,
          clubes: [clubId],
          categorias: [categoria],
          createdBy: req.user?.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else if (newUserRole === "jugador") {
        await db.collection("jugadores").doc(userRef.id).set({
          email,
          clubId,
          categoria,
          createdBy: req.user?.email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Creamos usuario en Firebase Auth con password vacío
      await createAuthUserIfNotExists(email);

      // Enviamos mail de activación
      await sendActivationEmail(email, activationToken, email);

      return res.json({ success: true, message: "Usuario creado correctamente y mail enviado" });
    }

    // Usuario ya existe → agregamos rol si corresponde
    const userDoc = existingSnap.docs[0];
    const userData = userDoc.data();
    const roles = userData.roles || {};

    if (roles[newUserRole]) {
      return res.status(400).json({ message: `Usuario ya tiene rol ${newUserRole}` });
    }

    // Agregamos rol nuevo
    if (newUserRole === "jugador") {
      roles.jugador = [{ clubId, categoria, estado: "PENDIENTE" }];
      await db.collection("jugadores").doc(userDoc.id).set({
        email,
        clubId,
        categoria,
        createdBy: req.user?.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (newUserRole === "profesor") {
      roles.profesor = { clubes: [clubId], categorias: [categoria], estado: "PENDIENTE" };
      await db.collection("profesores").doc(userDoc.id).set({
        email,
        clubes: [clubId],
        categorias: [categoria],
        createdBy: req.user?.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (newUserRole === "admin_club") {
      roles.admin_club = { estado: "PENDIENTE" };
    }

    await userDoc.ref.update({
      roles,
      updatedAt: new Date(),
    });

    await sendActivationEmail(email, activationToken, email);

    res.json({ success: true, message: "Rol agregado correctamente y mail enviado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createUser };
