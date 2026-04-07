const admin = require("firebase-admin");
const fs = require("fs");
const serviceAccount = JSON.parse(fs.readFileSync("/secrets/firebase", "utf8"));   

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "asambal.firebasestorage.app"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
console.log(bucket.name);
module.exports = { admin, db, bucket };