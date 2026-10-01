import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { config } from "../../config.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudinary_name,
  api_key: config.cloudinary.cloudinary_api_key,
  api_secret: config.cloudinary.cloudinary_api_secret,
});

// Todas las imágenes de productos se guardan en la carpeta
// "industrias-charly/productos" del Cloudinary del proyecto.
//
// Las fotos de iPhone salen en formato HEIC por defecto (la galería del
// celular no las re-codifica a JPEG antes de subirlas), y HEIC no se puede
// mostrar en la mayoría de navegadores. `format: "jpg"` fuerza a Cloudinary a
// re-codificar CUALQUIER imagen entrante (HEIC incluido) a JPEG al subirla,
// así el resto del sistema (web, catálogo público) siempre recibe un formato
// universalmente soportado sin importar desde qué celular se subió.
//
// OJO: no combinar esto con `allowed_formats` — probado a mano, Cloudinary
// ignora `format` (no convierte) apenas `allowed_formats` está presente en
// la misma llamada, y el archivo queda guardado en su formato original. Sin
// `allowed_formats`, cualquier archivo que Cloudinary NO pueda decodificar
// como imagen simplemente falla con un error normal (lo captura el
// errorHandler de app.js), así que no hace falta esa whitelist aparte.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "industrias-charly/productos",
    format: "jpg",
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  },
});

export const uploadProductImages = multer({ storage });

export default cloudinary;
