const admin = require("firebase-admin");
const fs = require("fs");
const serviceAccount = JSON.parse(fs.readFileSync("/secrets/firebase", "utf8"));   

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "asambal.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };