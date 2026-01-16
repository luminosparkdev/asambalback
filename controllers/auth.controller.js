const { db } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/token");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");


// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userSnap = await db.collection("usuarios").where("email", "==", email).get();

    if (userSnap.empty) return res.status(400).json({ message: "Usuario no encontrado" });

    const userData = userSnap.docs[0].data();

    let coachId = null;
    if (userData.role === "profesor") {
      const profSnap = await db
      .collection("profesores")
      .where("email", "==", userData.email)
      .limit(1)
      .get();
      
      if (!profSnap.empty) {
        coachId = profSnap.docs[0].id;
      }
    }

    if (userData.status !== "ACTIVO") {
      return res.status(400).json({
        message: "Usuario no activo",
        status: userData.status,
      });
    }
    const isMatch = bcrypt.compareSync(password, userData.password);
    if (!isMatch) return res.status(400).json({ message: "Contraseña incorrecta" });

    const userDoc = userSnap.docs[0];

    const accessToken = generateAccessToken({ id: userDoc.id, email: userData.email, role: userData.role, clubId: userData.clubId || null, coachId });
    const refreshToken = generateRefreshToken({ email: userData.email });

    res.
     cookie("refreshToken",  refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
     })
    .json({ 
      user: { 
        email: userData.email, 
        role: userData.role, 
        clubId: userData.clubId || null,
        coachId,
      }, 
      token: accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//GENERAMOS REFRESH TOKEN
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = verifyRefreshToken(token);

    const userSnap = await db
      .collection("usuarios")
      .where("email", "==", decoded.email)
      .limit(1)
      .get();

    if (userSnap.empty) {
      return res.status(401).json({ message: "Usuario no válido" });
    }

    const user = userSnap.docs[0].data();

    if (user.status !== "ACTIVO") {
      return res.status(403).json({ message: "Usuario no activo" });
    }

    let coachId = null;

    if (user.role === "profesor") {
      const profSnap = await db
      .collection("profesores")
      .where("email", "==", user.email)
      .limit(1)
      .get();
      
      if (!profSnap.empty) {
        coachId = profSnap.docs[0].id;
      }
    } 

    const userDoc = userSnap.docs[0];
    
    const newAccessToken = generateAccessToken({
      id: userDoc.id,
      email: user.email,
      role: user.role,
      clubId: user.clubId || null,
      coachId,
    });

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error("❌ ERROR refreshToken:", err.message);
    res.status(401).json({ message: "Refresh token inválido" });
  }
};

// ACTIVACION DE CUENTA
const activateAccount = async (req, res) => {
  try {
    const { email, password, token, } = req.body;

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

    if (newStatus === "ACTIVO" && userData.role === "admin_asambal") {
      await createAuthUserIfNotExists(email, password);
    } 

    await userDoc.ref.update({
      password: hashedPassword,
      status: newStatus,
      activationToken: null,
      updatedAt: new Date(),
    });

    const tokenJwt = generateAccessToken({
      id: userDoc.id,
      email: userData.email,
      role: userData.role,
      clubId: userData.clubId || null,
    });

    res.json({ success: true, newStatus, userId: userDoc.id, role: userData.role, 
      clubId: userData.clubId || null,
      token: tokenJwt});
  } catch (err) {
    console.error("❌ ERROR activateAccount:", err);
    res.status(500).json({ message: err.message });
  }
};



module.exports = { login, activateAccount, refreshToken };
