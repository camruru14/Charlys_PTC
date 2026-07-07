const validator = require('validator');

// Funciones de validación
const validateEmail = (email) => {
  return validator.isEmail(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

module.exports = {
  validateEmail,
  validatePassword,
};
