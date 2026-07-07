const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Rutas básicas
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido a la API de Charlys PTC' });
});

// Importar rutas
// app.use('/api/routes', require('./src/routes/'));

module.exports = app;
