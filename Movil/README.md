# Industrias Charly — App móvil

App de Expo para el panel administrativo. Usa la API de `Web/private/backend`
(Express, rutas bajo `/api`, autenticación con `Authorization: Bearer <token>`).

## Configurar la URL de la API

`src/lib/api.js` resuelve la URL del backend en este orden:

1. **`EXPO_PUBLIC_API_URL`** en `Movil/.env`, tal cual. Sin barra final y
   terminada en `/api` (ej. `https://mi-dominio.com/api`). Para un backend
   desplegado o un túnel.
2. **IP del servidor de desarrollo de Expo** con el puerto 4000
   (`http://<ip-de-la-computadora>:4000/api`). Con Expo Go en un celular en la
   misma red Wi-Fi funciona sin configurar nada.
3. **Sin servidor de Expo** (build sin Metro) o **Expo por túnel**:
   `http://10.0.2.2:4000/api` en Android (emulador) y
   `http://localhost:4000/api` en iOS (simulador). Si Expo corre por túnel, la
   app muestra un aviso en la consola pidiendo definir `EXPO_PUBLIC_API_URL`.

`EXPO_PUBLIC_API_URL` se define en `Movil/.env` e incluye el `/api` final, por
ejemplo:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api
```

Las variables `EXPO_PUBLIC_` se leen al iniciar Expo: después de definirla o
cambiarla, reinicia con `npx expo start -c`.

## Probar con el backend local

1. Levanta el backend: en `Web/private/backend`, `npm run dev` (puerto 4000).
2. En Windows, permite el puerto 4000 en el Firewall de Windows (red privada)
   para que el celular pueda entrar. El celular debe estar en el mismo Wi-Fi
   que la computadora.
3. Abre la app con `npx expo start`. Si Expo Go está por túnel, define
   `EXPO_PUBLIC_API_URL` en `Movil/.env` con la URL pública del backend.

## Usar un backend desplegado

Pon su URL en `Movil/.env` (`EXPO_PUBLIC_API_URL=https://mi-dominio.com/api`) y
reinicia Expo con `npx expo start -c` (las variables `EXPO_PUBLIC_` se leen al
iniciar).
