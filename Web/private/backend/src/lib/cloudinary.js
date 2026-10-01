import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { config } from "../../config.js";

// Logo de la empresa (Configuración) y fotos de producto (Catálogo), con las
// mismas credenciales que public/backend. Aquí multer guarda el archivo en
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

// Fotos de producto del Catálogo: hasta 6 por envío (campo "images"), de
// hasta 10 MB cada una (las de celular suelen pasar de 5 MB).
export const PRODUCT_IMAGE_MAX_MB = 10;

export const uploadProductImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_IMAGE_MAX_MB * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    const error = new Error("Solo se pueden subir imágenes");
    error.status = 400;
    cb(error);
  },
});

// Sube el buffer a "industrias-charly/productos", la misma carpeta y los
// mismos parámetros que usaba public/backend: `format: "jpg"` re-codifica
// cualquier entrada (HEIC de iPhone incluido) a JPEG, que todos los
// navegadores muestran. No combinar con `allowed_formats`: Cloudinary ignora
// `format` si ambos van en la misma llamada.
export function uploadProductImageBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "industrias-charly/productos",
        format: "jpg",
        transformation: [{ width: 1600, height: 1600, crop: "limit" }],
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export default cloudinary;
