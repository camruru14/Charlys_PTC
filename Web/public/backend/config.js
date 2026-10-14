import dotenv from "dotenv";

dotenv.config();

export const config = {
  db: {
    URI: process.env.DB_URI,
  },
  JWT: {
    secret: process.env.JWT_Secret_key,
  },
  server: {
    port: process.env.PORT || 4100,
  },
  email: {
    user_email: process.env.USER_EMAIL,
    user_password: process.env.USER_PASSWORD,
    // Brevo (API HTTP): con BREVO_API_KEY los correos salen por ahí; sin ella, por SMTP de Gmail (src/utils/mailer.js).
    brevoApiKey: process.env.BREVO_API_KEY,
    from: process.env.MAIL_FROM || process.env.USER_EMAIL,
    fromName: process.env.MAIL_FROM_NAME || "Industrias Charly",
  },
  // Wompi El Salvador usa OAuth2 (Client Credentials) para autenticarse, y
  // tokenización directa para cobrar: la tarjeta se tokeniza y se cobra
  // desde este backend (ver src/utils/wompiClient.js), sin enlaces de pago
  // ni webhooks — por eso no hace falta ninguna URL pública propia.
  wompi: {
    authUrl: process.env.WOMPI_AUTH_URL || "https://id.wompi.sv/connect/token",
    apiUrl: process.env.WOMPI_API_URL || "https://api.wompi.sv",
    grantType: process.env.GRANT_TYPE,
    audience: process.env.AUDIENCE,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  },
};
