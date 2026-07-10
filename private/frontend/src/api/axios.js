import axios from 'axios';

// Creamos la instancia de conexión hacia tu backend
const api = axios.create({
  baseURL: 'http://localhost:3000/api', // Asegúrate de que este sea el puerto donde corre tu backend
});

// Este interceptor intercepta cada petición y le pega el Token JWT si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;