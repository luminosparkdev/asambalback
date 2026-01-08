const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "unSecretSuperSecreto";

const generateToken = (payload, expiresIn = "1h") => {
  return jwt.sign(payload, SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};

module.exports = { generateToken, verifyToken };
