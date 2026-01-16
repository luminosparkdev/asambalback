const { db } = require("../config/firebase");
const { createAuthUserIfNotExists } = require("../utils/firebaseAuth");

const serializeTimestamps = (data) => {
  const result = {};
  for (const key in data) {
    if (data[key]?.toDate) {
      result[key] = data[key].toDate(); 
    } else {
      result[key] = data[key];
    }
  }
  return result;
};

const getMyAsambalProfile = async (req, res) => {
  try {
    const snapshot = await db
      .collection("usuarios")
      .where("role", "==", "admin_asambal")
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ message: "Perfil ASAMBAL no encontrado" });

    const doc = snapshot.docs[0];
    const data = serializeTimestamps(doc.data());

    res.json({ id: doc.id, ...data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateMyAsambalProfile = async (req, res) => {
  try {
    const snapshot = await db
      .collection("usuarios")
      .where("role", "==", "admin_asambal")
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ message: "Perfil ASAMBAL no encontrado" });

    const doc = snapshot.docs[0];
    const currentData = doc.data();

    const updatedPerfil = {
      ...currentData.perfil,
      ...(req.body.perfil || {}),
    };

    const dataToUpdate = {
      perfil: updatedPerfil,
      updatedAt: new Date(),
    };

    await db.collection("usuarios").doc(doc.id).update(dataToUpdate);

    const responseData = {
      id: doc.id,
      ...serializeTimestamps({ ...currentData, ...dataToUpdate }),
    };

    // Devolvemos TODO el admin actualizado
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const usersSnap = await db
      .collection("usuarios")
      .where("status", "==", "PENDIENTE")
      .get();

    const result = [];

    for (const doc of usersSnap.docs) {
      const user = doc.data();

      if (user.role === "admin_club") {
        const clubSnap = await db.collection("clubes").doc(user.clubId).get();

        result.push({
          userId: doc.id,
          email: user.email,
          role: user.role,
          club: clubSnap.exists ? clubSnap.data() : null,
        });
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const validateUser = async (req, res) => {
  try {
    const { userId, action } = req.body;

    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const userData = userSnap.data();
    
    if (!userData.clubId) {
      return res.status(400).json({ message: "El usuario no tiene club asociado" });
    }

    const clubRef = db.collection("clubes").doc(userData.clubId);
    const clubSnap = await clubRef.get();

    if (!clubSnap.exists) {
      return res.status(404).json({ message: "Club no encontrado" });
    }

    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    await db.runTransaction(async (tx) => {
      tx.update(userRef, { 
        status: newStatus,
        updatedAt: new Date(),
      });

      if (action === "APPROVE") {
        tx.update(clubRef, { 
          status: newStatus,
          updatedAt: new Date(),
        });
      }

      if (action === "REJECT") {
        tx.update(clubRef, { 
          status: "RECHAZADO",
          updateAt: new Date(),
        });
      }
    });

    if (action === "APPROVE") {
      await createAuthUserIfNotExists(userData.email);
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getPendingUsers, validateUser, getMyAsambalProfile, updateMyAsambalProfile };
