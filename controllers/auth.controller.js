const { db } = require("../config/firebase");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/token");
const { getAuth } = require("firebase-admin/auth");
const axios = require("axios");

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const auth = getAuth();

    // 1️⃣ Verificar usuario en Auth
    let fbUser;
    try {
      fbUser = await auth.getUserByEmail(email);
    } catch (err) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    // 2️⃣ Validar password vía Firebase REST
    const fbKey = process.env.FIREBASE_API_KEY;
    let fbLoginResponse;
    try {
      const response = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fbKey}`,
        {
          email,
          password,
          returnSecureToken: true,
        }
      );
      fbLoginResponse = response.data;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message;
      if (errMsg === "EMAIL_NOT_FOUND") {
        return res.status(400).json({ message: "Usuario no encontrado" });
      } else if (errMsg === "INVALID_PASSWORD") {
        return res.status(400).json({ message: "Contraseña incorrecta" });
      } else if (errMsg === "USER_DISABLED") {
        return res.status(403).json({ message: "Usuario deshabilitado" });
      } else {
        console.error("Firebase REST LOGIN ERROR:", errMsg);
        return res.status(500).json({ message: "Error interno de autenticación" });
      }
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

    if (userData.status !== "ACTIVO") {
      return res.status(403).json({ message: "Tu cuenta aún no ha sido validada" });
    }

    const roles = Array.isArray(userData.roles)
      ? userData.roles
      : Object.values(userData.roles || {});

    const clubs = userData.clubs || [];

    // 4️⃣ Generar tokens
    const accessToken = generateAccessToken({
      id: userDoc.id,
      email: userData.email,
      roles,
      clubs,
    });

    const refreshToken = generateRefreshToken({ email: userData.email });

    // 5️⃣ Response: solo la cookie contiene refreshToken
    return res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: true,
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
    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", decoded.email)
      .limit(1)
      .get();

    if (userSnap.empty) return res.status(401).json({ message: "Usuario no válido" });

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.status !== "ACTIVO") return res.status(403).json({ message: "Usuario no activo" });

    const clubs = userData.clubs || [];
    const rolesRaw = userData.roles || [];
    const roles = Array.isArray(rolesRaw) ? rolesRaw : Object.values(rolesRaw || {});

    const newAccessToken = generateAccessToken({
      id: userDoc.id,
      email: userData.email,
      roles,
      clubs,
    });

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error("❌ ERROR refreshToken:", err);
    res.status(401).json({ message: "Refresh token inválido" });
  }
};

// ACTIVAR CUENTA
const activateAccount = async (req, res) => {
  try {
    const { email, password, token, profileData } = req.body;

    if (!email || !password || !token) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userDoc = userSnap.docs[0];
    const userData = userDoc.data();

    if (userData.activationToken !== token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    await createAuthUserIfNotExists(email, password);

    let roles = [];
    if (Array.isArray(userData.roles)) {
      roles = [...userData.roles];
    } else if (userData.roles && typeof userData.roles === "object") {
      roles = Object.values(userData.roles);
    }

    await userDoc.ref.update({
      status: "PENDIENTE",
      roles,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: "Perfil activado, pendiente de aprobación",
      roles,
      userId: userDoc.id,
      clubId: userData.clubs?.[0]?.clubId || userData.clubId || null,
    });
  } catch (err) {
    console.error("❌ ERROR activateAccount:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { activateAccount, login, refreshToken };