module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/charlys-ptc',
  JWT_SECRET: process.env.JWT_SECRET || 'tu_secreto_jwt_aqui',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
