import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { config } from "../../config.js";

// Logo de la empresa (Configuración) y fotos de producto (Catálogo), con las
// mismas credenciales que public/backend. Aquí multer guarda el archivo en
// memoria y se sube con el SDK de cloudinary.
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

// Foto del vehículo (Configuración > Vehículos): una sola imagen de hasta 5 MB.
export const uploadVehicleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    const error = new Error("La foto debe ser una imagen");
    error.status = 400;
    cb(error);
  },
});

// Sube el buffer a "industrias-charly/vehiculos". JPEG (como los productos):
// re-codifica cualquier entrada, HEIC incluido.
export function uploadVehicleImageBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "industrias-charly/vehiculos",
        format: "jpg",
        transformation: [{ width: 1200, height: 1200, crop: "limit" }],
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

// Factura de un movimiento de Finanzas: una imagen o un PDF de hasta 10 MB
// (campo "file").
export const TRANSACTION_FILE_MAX_MB = 10;

export const uploadTransactionFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TRANSACTION_FILE_MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/") || file.mimetype === "application/pdf") return cb(null, true);
    const error = new Error("La factura debe ser una imagen o un PDF");
    error.status = 400;
    cb(error);
  },
});

// ¿El buffer es un PDF? Por su firma "%PDF" o, si no, por la extensión.
const isPdf = (buffer, originalName) => buffer.subarray(0, 4).toString("latin1") === "%PDF" || /\.pdf$/i.test(originalName || "");

// Sube el buffer a "industrias-charly/finanzas". Con resource_type "image"
// también el PDF queda con una URL que el navegador puede abrir. Las imágenes
// se limitan a 1600×1600 y se re-codifican a JPEG (HEIC de iPhone incluido),
// como las de los productos; el PDF se sube tal cual, sin transformación.
// Devuelve el resultado de Cloudinary: guardar `secure_url`, `public_id` y
// `resource_type` (hace falta para borrarlo después).
export function uploadTransactionFileBuffer(buffer, originalName) {
  const options = isPdf(buffer, originalName)
    ? { folder: "industrias-charly/finanzas", resource_type: "image" }
    : {
        folder: "industrias-charly/finanzas",
        resource_type: "image",
        format: "jpg",
        transformation: [{ width: 1600, height: 1600, crop: "limit" }],
      };
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => (error ? reject(error) : resolve(result)));
    stream.end(buffer);
  });
}

export default cloudinary;
