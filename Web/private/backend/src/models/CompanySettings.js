import { Schema, model } from "mongoose";

// Ficha de la empresa (un solo documento), editable en Configuración >
// Empresa. Antes vivía solo en el localStorage del navegador; ahora la
// comparten todos los usuarios del panel. Colección nueva: no cambia ninguna
// de las existentes.
export const DEFAULT_COMPANY = {
  name: "Industrias Charly",
  nit: "",
  email: "",
  phone: "",
  address: "",
  // El sistema solo maneja dólares (fmtMoney del panel y la tienda): se
  // guarda para dejarlo explícito, pero no se puede cambiar desde el panel.
  currency: "USD",
};

const companySettingsSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, default: DEFAULT_COMPANY.name },
    nit: { type: String, trim: true, default: "" },
    // Correo de contacto
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    // Dirección fiscal
    address: { type: String, trim: true, default: "" },
    currency: { type: String, enum: ["USD"], default: DEFAULT_COMPANY.currency },
    // Logo en Cloudinary (carpeta industrias-charly/empresa).
    logo: {
      url: { type: String },
      publicId: { type: String },
    },
  },
  {
    timestamps: true,
  },
);

export default model("CompanySettings", companySettingsSchema);
