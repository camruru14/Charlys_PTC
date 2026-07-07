const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Base de datos conectada exitosamente');
  } catch (error) {
    console.error('Error al conectar la base de datos:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
