const sharp = require("sharp");

const convertToWebp = async ({
  buffer,
  width = 1920,
  quality = 80,
}) => {
  return sharp(buffer)
    .resize({
      width,
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();
};

module.exports = {
  convertToWebp,
};
