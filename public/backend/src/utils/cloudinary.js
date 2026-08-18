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
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "industrias-charly/productos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  },
});

export const uploadProductImages = multer({ storage });

export default cloudinary;
