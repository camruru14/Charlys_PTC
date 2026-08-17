# Industrias Charly — Tienda en línea (frontend público)

Frontend de la tienda pública: catálogo, carrito, checkout con Wompi y
cuenta de cliente. Diseño portado del mockup de PaginaCurtis, con la marca
ajustada a Industrias Charly.

## Puesta en marcha

1. **Renombra el archivo de entorno:** busca `ENV_RENOMBRAR_A_.env.txt` en
   esta carpeta y renómbralo a `.env` (ya trae `VITE_API_URL` apuntando al
   backend local).
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
