// Llave de prueba para lib/passwordCrypto.js: se importa ANTES que el código
// del backend para no depender del .env (dotenv no pisa variables ya puestas).
process.env.EMPLOYEE_PASSWORD_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
