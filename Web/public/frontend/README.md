# Industrias Charly — Tienda en línea (frontend público)

Frontend de la tienda pública: catálogo, carrito, checkout con Wompi y
cuenta de cliente. Diseño portado del mockup de PaginaCurtis, con la marca
ajustada a Industrias Charly.

## Puesta en marcha

1. **Crea el archivo de entorno:** crea un archivo `.env` en esta carpeta con
   las variables descritas en [Variables de entorno](#variables-de-entorno).
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Levanta el servidor de desarrollo (con el backend ya corriendo en el
   puerto 4100):
   ```bash
   npm run dev
   ```
   Abre en `http://localhost:5175`.

## Variables de entorno

Se definen en el archivo `.env` de esta carpeta (no se sube al repositorio).
Son variables de Vite: se leen al compilar, así que **después de cambiarlas
hay que reiniciar `npm run dev`** (o volver a hacer build).

- `VITE_API_URL` — URL de `public/backend` (la API de la tienda). Si no se
  define, se usa `http://localhost:4100/api`. En producción apúntala al
  backend desplegado.
- `VITE_WOMPI_SANDBOX` — modo sandbox de Wompi. Solo con el valor `true` el
  checkout muestra el botón «Usar tarjeta de prueba» y el aviso «no se cobra
  dinero real». Úsala en `true` **únicamente** mientras `public/backend` tenga
  credenciales de prueba de Wompi. En producción déjala vacía o en `false`
  (cualquier otro valor se trata como producción).

Ejemplo para desarrollo local:

```
VITE_API_URL=http://localhost:4100/api
VITE_WOMPI_SANDBOX=false
```

## Estructura

- `src/pages` — una página por ruta (Inicio, Productos, Detalle de
  producto, Carrito, Checkout, Confirmación de pedido, Login, Registro, Mis
  pedidos, Beneficios, Contacto).
- `src/context/CartContext.jsx` — carrito persistido en `localStorage`.
- `src/context/AuthContext.jsx` — sesión de cliente (cookie httpOnly del
  backend).
- `src/lib/api.js` — cliente HTTP hacia el backend público.

## Notas

- Las imágenes de `src/assets` son las 3 fotos de ejemplo del mockup de
  PaginaCurtis (placeholder). Reemplázalas por fotografía real del producto
  cuando la tengan.
- Los datos de contacto en `ContactoPage.jsx` y `Footer.jsx` son de
  ejemplo — actualízalos con los reales del equipo.
- En este entorno no fue posible correr `npm install` (el registro de npm
  no es accesible desde aquí), así que el código no se probó con un `npm
  run dev`/`npm run build` real. Se verificó sintaxis de cada archivo, y que
  todos los imports (locales y de paquetes) resuelvan correctamente.
