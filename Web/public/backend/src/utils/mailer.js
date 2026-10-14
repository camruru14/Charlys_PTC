import nodemailer from "nodemailer";
import { config } from "../../config.js";

/*
  Envío de correos de la tienda. Con BREVO_API_KEY se manda por la API HTTP de Brevo (Render gratis
  bloquea los puertos SMTP); sin ella (desarrollo local) se usa nodemailer con Gmail, como antes.
  Variables: BREVO_API_KEY, MAIL_FROM (remitente verificado en Brevo; si falta, USER_EMAIL) y
  MAIL_FROM_NAME (por defecto «Industrias Charly»). Ver el README del backend de la tienda.
*/
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 15000;

const usesBrevo = Boolean(config.email.brevoApiKey);
console.log(usesBrevo ? "Correo: Brevo API" : "Correo: SMTP Gmail");

async function sendWithBrevo({ to, subject, html }) {
  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": config.email.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.email.from, name: config.email.fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    // Solo el status y el mensaje de Brevo: nunca la API key.
    const body = await response.json().catch(() => null);
    throw new Error(`Brevo respondió ${response.status}${body?.message ? `: ${body.message}` : ""}`);
  }
}

let transporter;
function sendWithGmail({ to, subject, html }) {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.email.user_email, pass: config.email.user_password },
  });
  return transporter.sendMail({ from: config.email.from, to, subject, html });
}

export async function sendMail({ to, subject, html }) {
  return usesBrevo ? sendWithBrevo({ to, subject, html }) : sendWithGmail({ to, subject, html });
}

export default sendMail;
