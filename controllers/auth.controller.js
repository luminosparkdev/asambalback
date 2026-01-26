const { db } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/token");
const { getAuth } = require("firebase-admin/auth");

//LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const auth = getAuth();

    // 1️⃣ Verificar usuario en Auth
    try {
      await auth.getUserByEmail(email);
    } catch (err) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    // 2️⃣ Validar password vía Firebase REST
    const axios = require("axios");
    const fbKey = process.env.FIREBASE_API_KEY;

    try {
      await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fbKey}`,
        {
          email,
          password,
          returnSecureToken: true,
        }
      );
    } catch (err) {
      return res.status(400).json({ message: "Contraseña incorrecta" });
    }

    // 3️⃣ Obtener usuario de Firestore
    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(400).json({ message: "Usuario no registrado" });
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    const roles = Array.isArray(userData.roles)
      ? userData.roles
      : Object.values(userData.roles || {});

    // 🔥 CLUBIDS UNIFICADOS
    const clubs = userData.clubs || [];

    // 4️⃣ Token
    const accessToken = generateAccessToken({
      id: userDoc.id,
      email: userData.email,
      roles,
      clubs,// 👈 AHORA SÍ
    });

    const refreshToken = generateRefreshToken({
      email: userData.email,
    });

    console.log("ACCESS TOKEN: ", accessToken);
    console.log("REFRESH TOKEN: ", refreshToken);
    console.log("USER DATA: ", userData);
    console.log("Clubes  : ", clubs);

    // 5️⃣ Response
    return res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: {
          id: userDoc.id,
          email: userData.email,
          roles,
          clubs,
        },
        token: accessToken,
      });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};

// REFRESH TOKEN
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const decoded = verifyRefreshToken(token);
    const userSnap = await db.collection("usuarios").where("email", "==", decoded.email).limit(1).get();

    if (userSnap.empty) return res.status(401).json({ message: "Usuario no válido" });

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.status !== "ACTIVO") return res.status(403).json({ message: "Usuario no activo" });

    const rolesRaw = userData.roles || [];
    const roles = Array.isArray(rolesRaw)
      ? rolesRaw
      : Object.values(rolesRaw || {});
    const clubId = roles.includes("admin_club") ? userData.clubId : null;

    const newAccessToken = generateAccessToken({
      id: userDoc.id,
      email: userData.email,
      roles,
      clubId,
    });

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error("❌ ERROR refreshToken:", err);
    res.status(401).json({ message: "Refresh token inválido" });
  }
};

// Activar cuenta (completar perfil y password)
const activateAccount = async (req, res) => {
  try {
    const { email, password, token, profileData } = req.body;

    if (!email || !password || !token) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Buscamos usuario
    const userSnap = await db.collection("usuarios").where("email", "==", email).limit(1).get();
    if (userSnap.empty) return res.status(404).json({ message: "Usuario no encontrado" });

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.activationToken !== token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    // Hash password y actualizamos Firebase Auth
    await createAuthUserIfNotExists(email, password); // Si no existe en Firebase Auth lo crea

    // Actualizamos usuario en Firestore
    const newRoles = { ...userData.roles };

    // Si es profesor o jugador, agregamos campos del perfil
    if (profileData) {
      if (newRoles.profesor) {
        newRoles.profesor.perfil = profileData;
      } else if (newRoles.jugador) {
        newRoles.jugador.forEach(j => j.perfil = profileData);
      }
    }

    await userDoc.ref.update({
      status: "PENDIENTE",  // PENDIENTE hasta que lo apruebe quien corresponda
      roles: newRoles,
      updatedAt: new Date(),
    });

    const rolesArray = userData.roles || [];
    

    res.json({ success: true, message: "Perfil activado, pendiente de aprobación", roles: rolesArray, userId: userDoc.id, clubId: userData.clubId || null });
  } catch (err) {
    console.error("❌ ERROR activateAccount:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { activateAccount, login, refreshToken };
