const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const { uploadCertificado, getMyCertificados, deleteCertificado, getPendingCertificados, approveCertificado, rejectCertificado, getCertificadoFile } = require("../controllers/certificados.controller");

const upload = multer({ storage: multer.memoryStorage() });

// Rutas para jugadores
// Obtener certificados del usuario
router.get("/my", authMiddleware, getMyCertificados);
// Subir nuevo certificado
router.post("/upload", authMiddleware, upload.single("file"), uploadCertificado);
// Eliminar certificado pendiente
router.delete("/:id", authMiddleware, deleteCertificado);

// Rutas para profesores
// Listar certificados pendientes para revisión
router.get("/pending", authMiddleware, getPendingCertificados);
// Aprobar certificado
router.patch("/:id/approve", authMiddleware, approveCertificado);
// Rechazar certificado
router.patch("/:id/reject", authMiddleware, rejectCertificado);
// Obtener archivo de certificado (signed URL temporal)
router.get("/:id/file", authMiddleware, getCertificadoFile);

module.exports = router;