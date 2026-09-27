import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { config } from "../../config.js";

// Mismo servicio y credenciales que las fotos de producto del Catálogo
// (public/backend/src/utils/cloudinary.js). Aquí multer guarda el archivo en
// memoria y se sube con el SDK de cloudinary: el multer-storage-cloudinary
// instalado en este backend es la 2.x, con otra API y atado a cloudinary 1.x.
cloudinary.config({
  cloud_name: config.cloudinary.cloudinary_name,
  api_key: config.cloudinary.cloudinary_api_key,
  api_secret: config.cloudinary.cloudinary_api_secret,
});

// Logo de la empresa: una sola imagen de hasta 5 MB.
export const uploadCompanyLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    const error = new Error("El logo debe ser una imagen");
    error.status = 400;
    cb(error);
  },
});

// Sube el buffer a "industrias-charly/empresa". PNG (no jpg, como los
// productos) para conservar la transparencia; cualquier formato de entrada
// (HEIC incluido) se re-codifica.
export function uploadLogoBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "industrias-charly/empresa",
        format: "png",
        transformation: [{ width: 512, height: 512, crop: "limit" }],
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export default cloudinary;
