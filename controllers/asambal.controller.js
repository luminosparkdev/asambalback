const { db } = require("../config/firebase");

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
    const { userId, action } = req.body; // action: "APPROVE" | "REJECT"

    const userRef = db.collection("usuarios").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const newStatus = action === "APPROVE" ? "ACTIVO" : "RECHAZADO";

    await userRef.update({
      status: newStatus,
      updatedAt: new Date(),
    });

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
    
module.exports = { getPendingUsers, validateUser };
