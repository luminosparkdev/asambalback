const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("No se encontraron variables de entorno");
}

const generateAccessToken = (payload) => {
  return jwt.sign(payload,ACCESS_SECRET, { expiresIn: "15m" })
}

const generateRefreshToken = (payload) => {
  return jwt.sign(payload,REFRESH_SECRET, { expiresIn: "7d" })
};

const verifyAccessToken = (token) => {
  return jwt.verify(token,ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token,REFRESH_SECRET);
};

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
