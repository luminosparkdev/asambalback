const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middlewares/auth.middleware");
const { uploadCertificado, getMyCertificados, deleteCertificado } = require("../controllers/certificados.controller");

const upload = multer({ storage: multer.memoryStorage() });

// Obtener certificados del usuario
router.get("/my", authMiddleware, getMyCertificados);

// Subir nuevo certificado
router.post("/upload", authMiddleware, upload.single("file"), uploadCertificado);

// Eliminar certificado pendiente
router.delete("/:id", authMiddleware, deleteCertificado);

module.exports = router;