const admin = require("firebase-admin");

const bucket = admin.storage().bucket();

const uploadPublicImage = async ({
  path,
  buffer,
  cacheControl = "public, max-age=31536000",
}) => {
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType: "image/webp",
    public: true,
    metadata: { cacheControl },
  });

  return `https://storage.googleapis.com/${bucket.name}/${path}?v=${Date.now()}`;
};

const deleteFile = async (path) => {
  try {
    await bucket.file(path).delete();
  } catch (err) {
    console.warn("No se pudo borrar:", path);
  }
};

module.exports = {
  uploadPublicImage,
  deleteFile,
};
