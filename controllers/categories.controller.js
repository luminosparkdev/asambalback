const admin = require("firebase-admin");
const db = admin.firestore();

const getCategories = async (req, res) => {
  try {
    const { genero } = req.query;

    let query = db.collection("categorias");

    if (genero) {
      query = query.where("genero", "==", genero);
    }

    const snapshot = await query.orderBy("nombre").get();

    const categories = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

module.exports = {
  getCategories,
};
