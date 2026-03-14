const { getStorage } = require("firebase-admin/storage");
const { getFirestore } = require("firebase-admin/firestore");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

const db = getFirestore();
const storage = getStorage().bucket();

// Subir certificado
const uploadCertificado = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Archivo requerido" });

    const file = req.file;
    const ext = file.originalname.split(".").pop().toLowerCase();

    // Validar solo los tipos permitidos
    if (!["pdf", "jpg", "jpeg"].includes(ext)) {
      return res.status(400).json({ message: "Solo se permiten archivos PDF o JPG/JPEG" });
    }

    const userId = req.user.id;
    const year = new Date().getFullYear();

    // Limitar máximo 2 certificados por año
    const snapshot = await db.collection("certificados")
      .where("userId", "==", userId)
      .where("year", "==", year)
      .get();

    if (snapshot.size >= 2) {
      return res.status(400).json({ message: "Máximo 2 certificados por año" });
    }

    let uploadBuffer = file.buffer;
    let finalExt = ext;
    let contentType = file.mimetype;

    // Convertir JPG/JPEG a WebP
    if (["jpg", "jpeg"].includes(ext)) {
      uploadBuffer = await sharp(file.buffer)
        .webp({ quality: 80 })
        .toBuffer();
      finalExt = "webp";
      contentType = "image/webp";
    }

    // Guardar el archivo dentro de la carpeta "certificados"
    const fileName = `certificados/${userId}/${uuidv4()}.${finalExt}`;
    const fileRef = storage.file(fileName);

    await fileRef.save(uploadBuffer, {
      contentType,
      resumable: false,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(fileName)}?alt=media`;

    // Guardar metadata en Firestore
    const docRef = db.collection("certificados").doc();
    await docRef.set({
      userId,
      fileName,
      url: publicUrl,
      year,
      status: "PENDIENTE",
      uploadedAt: new Date(),
    });

    res.json({
      message: "Archivo subido y optimizado con éxito",
      certificado: { id: docRef.id, url: publicUrl, status: "PENDIENTE", year },
    });

  } catch (err) {
    console.error("Error al subir el certificado: ", err);
    res.status(500).json({ message: "Error al subir certificado", error: err.message || err });
  }
};

// Listar certificados del usuario
const getMyCertificados = async (req, res) => {
  try {
    const userId = req.user.id;
    const year = new Date().getFullYear();
    const snapshot = await db
      .collection("certificados")
      .where("userId", "==", userId)
      .where("year", "==", year)
      .get();

    const certificados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(certificados);
  } catch (err) {
    console.error("Error al obtener certificados:", err);
    res.status(500).json({ message: "Error al obtener certificados", error: err.message || err });
  }
};

// Eliminar certificados al final de año (31 de diciembre)
const deleteExpiredCertificados = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const expirationDate = new Date(currentYear, 11, 31); // 31 de diciembre

    if (currentDate >= expirationDate) {
      const snapshot = await db
        .collection("certificados")
        .where("year", "==", currentYear)
        .get();

      // Borrar todos los certificados del año
      snapshot.forEach(async (doc) => {
        const data = doc.data();
        await storage.file(data.fileName).delete(); // Borrar archivo en storage
        await doc.ref.delete(); // Borrar documento en Firestore
      });

      res.json({ message: "Todos los certificados del año han sido eliminados" });
    } else {
      res.json({ message: "Aún no es 31 de diciembre, no es necesario eliminar certificados" });
    }
  } catch (err) {
    console.error("Error al eliminar certificados expirados:", err);
    res.status(500).json({ message: "Error al eliminar certificados expirados", error: err.message || err });
  }
};

// Eliminar certificado pendiente
const deleteCertificado = async (req, res) => {
  try {
    const docRef = db.collection("certificados").doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ message: "Certificado no encontrado" });

    const data = doc.data();
    if (data.status !== "PENDIENTE") {
      return res.status(400).json({
        message: `No se puede eliminar un certificado con estado ${data.status}`,
      });
    }

    // Borrar archivo de Storage
    await storage.file(data.fileName).delete();

    // Borrar documento de Firestore
    await docRef.delete();

    res.json({ message: "Certificado eliminado" });
  } catch (err) {
    console.error("Error al eliminar certificado:", err);
    res.status(500).json({ message: "Error al eliminar certificado", error: err.message || err });
  }
};

module.exports = {
  uploadCertificado,
  getMyCertificados,
  deleteExpiredCertificados,
  deleteCertificado,
};