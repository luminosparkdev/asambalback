const admin = require("firebase-admin");
const db = admin.firestore();

const getFixture = async (req,res) => {
    try{
        let query = db.collection("fixture");
        const snapshot = await query.orderBy("fechanumero").get();

        const fechas = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    res.status(200).json(fechas);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
}

module.exports = {
  getFixture,
};