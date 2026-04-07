const { getStorage } = require("firebase-admin/storage");
const { getFirestore } = require("firebase-admin/firestore");
const { v4: uuidv4 } = require("uuid");
const { PDFDocument } = require("pdf-lib");
const admin = require("firebase-admin");

const db = getFirestore();
const { bucket } = require("../config/firebase");

/*----------------------------------------------------
----------- CONTROLADORES JUGADORES ------------------
----------------------------------------------------*/

// Subir certificado

const imageToPdf = async (buffer, mime) => {
  const pdfDoc = await PDFDocument.create();

  let image;

  if (mime === "image/png") {
    image = await pdfDoc.embedPng(buffer);
  } else if (mime === "image/jpeg" || mime === "image/jpg") {
    image = await pdfDoc.embedJpg(buffer);
  } else {
    throw new Error("Formato de imagen no soportado para conversión");
  }

  const page = pdfDoc.addPage([image.width, image.height]);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  return await pdfDoc.save();
};

const uploadCertificado = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Archivo requerido" });
    }

    const file = req.file;
    const ext = file.originalname.split(".").pop().toLowerCase();
    const mime = file.mimetype;

    // 🚨 IMPORTANTE: validación correcta (AND, no OR)
    const allowedExt = ["pdf", "jpg", "jpeg", "png"];
    const allowedMime = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];

    if (!allowedExt.includes(ext) || !allowedMime.includes(mime)) {
      return res.status(400).json({
        message: "Formato inválido. Usá PDF, JPG, JPEG o PNG.",
      });
    }

    // 🚨 Caso típico iPhone (HEIC disfrazado)
    if (mime === "image/heic" || ext === "heic") {
      return res.status(400).json({
        message:
          "Las fotos de iPhone no son compatibles. Convertí la imagen a JPG o PNG antes de subirla.",
      });
    }

    const userId = req.user.id;
    const year = new Date().getFullYear();

    const snapshot = await db
      .collection("certificados")
      .where("userId", "==", userId)
      .where("year", "==", year)
      .get();

    if (snapshot.size >= 2) {
      return res.status(400).json({
        message: "Máximo 2 certificados por año",
      });
    }

    let uploadBuffer;
    let contentType = "application/pdf";

    // 👉 IMAGEN → PDF
    if (mime.startsWith("image/")) {
      uploadBuffer = await imageToPdf(file.buffer, mime);
    } 
    // 👉 PDF → 그대로 (lo dejamos como está)
    else if (mime === "application/pdf") {
      uploadBuffer = file.buffer;
    }

    const fileName = `certificados/${userId}/${uuidv4()}.pdf`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(uploadBuffer, {
      contentType,
      resumable: false,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

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
      message: "Certificado subido correctamente",
      certificado: {
        id: docRef.id,
        url: publicUrl,
        status: "PENDIENTE",
        year,
      },
    });
  } catch (err) {
    console.error("Error al subir certificado:", err);

    res.status(500).json({
      message: "Error al procesar el archivo",
      error: err.message,
    });
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

/*----------------------------------------------------
----------- CONTROLADORES PROFESORES -----------------
----------------------------------------------------*/

// Listar certificados pendientes para revisión
const getPendingCertificados = async (req, res) => {
  try {

    const year = new Date().getFullYear();

    const snapshot = await db
      .collection("certificados")
      .where("year", "==", year)
      .where("status", "==", "PENDIENTE")
      .get();

    const certificados = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(certificados);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener certificados pendientes" });
  }
};

// Aprobar certificado
const approveCertificado = async (req, res) => {
  try {

    const { id } = req.params;

    const docRef = db.collection("certificados").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Certificado no encontrado" });
    }

    await docRef.update({
      status: "APROBADO",
      reviewedAt: new Date(),
      reviewedBy: req.user.id
    });

    res.json({ message: "Certificado aprobado" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al aprobar certificado" });
  }
};

// Rechazar certificado
const rejectCertificado = async (req, res) => {
  try {

    const { id } = req.params;
    const { reason } = req.body;

    const docRef = db.collection("certificados").doc(id);

    await docRef.update({
      status: "RECHAZADO",
      rejectedReason: reason || null,
      reviewedAt: new Date(),
      reviewedBy: req.user.id
    });

    res.json({ message: "Certificado rechazado" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al rechazar certificado" });
  }
};

// Obtener URL de certificado
const getCertificadoFile = async (req, res) => {
  try {

    const { id } = req.params;

    const doc = await db.collection("certificados").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Certificado no encontrado" });
    }

    const data = doc.data();

    const file = storage.file(data.fileName);

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 10 // 10 minutos
    });

    res.json({ url });

  } catch (err) {
    console.error("Error al generar signed URL:", err);
    res.status(500).json({
      message: "Error al obtener el archivo"
    });
  }
};

module.exports = {
  uploadCertificado,
  getMyCertificados,
  deleteExpiredCertificados,
  deleteCertificado,
  getPendingCertificados,
  approveCertificado,
  rejectCertificado,
  getCertificadoFile
};