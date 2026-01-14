const { admin } = require("../config/firebase");
const crypto = require("crypto");

const createAuthUserIfNotExists = async (email, password = null) => {
  try {
    await admin.auth().getUserByEmail(email);
    return { created: false };
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw err;
    }
  }

  const userRecord = await admin.auth().createUser({
    email,
    password: password || crypto.randomBytes(16).toString("hex"),
    emailVerified: true,
    disabled: false,
  });

  return { created: true, uid: userRecord.uid };
};

module.exports = { createAuthUserIfNotExists };
