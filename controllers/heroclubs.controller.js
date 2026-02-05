const { db } = require("../config/firebase");
const { uploadPublicImage } = require("../services/media.service");
const { convertToWebp } = require("../services/image.service");

const uploadClubHero = async (req, res) => {
  try {
    const { clubId } = req.params;
    const file = req.file;

    if (!clubId) {
      return res.status(400).json({ message: "clubId inválido" });
    }

    if (!file) {
      return res.status(400).json({ message: "No se envió imagen" });
    }

    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "El archivo debe ser una imagen" });
    }
    const webpBuffer = await convertToWebp({
      buffer: file.buffer,
      width: 1920,
      quality: 80,
    });

    const heroUrl = await uploadPublicImage({
      path: `clubs/${clubId}/hero.webp`,
      buffer: webpBuffer,
    });

    await db.collection("clubes").doc(clubId).update({
      heroUrl,
      heroUpdatedAt: new Date(),
    });

    res.json({ heroUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error subiendo hero" });
  }
};

module.exports = { uploadClubHero };
