const { verifyAccessToken } = require("../utils/token");
const { db } = require("../config/firebase");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Token no provisto" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { email, role, clubId, ... }

    if (req.user.clubId) {
      const clubSnap = await db.collection("clubes").doc(req.user.clubId).get();
      req.user.nombreClub = clubSnap.exists ? clubSnap.data().nombre : null;
    }
    console.log("AUTH USER:", req.user);
    console.log("ROLE EN TOKEN:", req.user.role);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

module.exports = authMiddleware;