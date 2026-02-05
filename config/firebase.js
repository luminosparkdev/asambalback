const admin = require("firebase-admin");
const serviceAccount = require("./firebaseKey.json"); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "asambal.firebasestorage.app",
});

const db = admin.firestore();
const storage = admin.storage();

module.exports = { admin, db, storage };
