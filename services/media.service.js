const { bucket } = require("../config/firebase");

const uploadPublicImage = async ({
  path,
  buffer,
  contentType,
  cacheControl = "public, max-age=31536000",
}) => {
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType,
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