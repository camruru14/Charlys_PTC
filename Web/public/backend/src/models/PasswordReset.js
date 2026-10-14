import { Schema, model } from "mongoose";

// Recuperación de contraseña de un cliente (ver controller/recoveryPasswordController.js).
// El código de 6 dígitos NUNCA se guarda ni viaja en una cookie o un JWT: solo su
// hash, sha256(code + resetId), con el _id de este documento como `resetId`.
// El documento se borra solo al vencer (TTL sobre expiresAt).
const passwordResetSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    // Intentos de verificar el código (máximo 5; al llegar al límite queda inválido).
    attempts: { type: Number, default: 0 },
    // Cuándo se acertó el código (habilita el paso de la contraseña nueva).
    verifiedAt: { type: Date, default: null },
    // Cuándo se usó para cambiar la contraseña (no se puede reutilizar).
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model("PasswordReset", passwordResetSchema);
