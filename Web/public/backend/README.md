# Industrias Charly — Backend público (tienda e-commerce)

API del sitio público de venta en línea. Comparte la base de datos MongoDB
con el panel privado (`private/backend`): los pedidos creados aquí aparecen
automáticamente en Pedidos / Inventario / Logística del panel administrativo.

La arquitectura sigue el mismo patrón que `private/backend`: rutas →
middlewares → controladores → modelos, todo detrás de la API HTTP. No hay
scripts que escriban directo a la base de datos por fuera de ese flujo (por
eso no existe un `seed.js` aquí, igual que en `private`): el catálogo se
carga llamando a la propia API, como lo haría cualquier cliente.

## Puesta en marcha

1. **Archivo de entorno.** Ya usas tu propio `.env` (con `DB_URI` apuntando
   a la misma base `INDUSTRIAS_CHARLY` que `private/backend`, y las
   credenciales de Cloudinary/Wompi que ya tenía el proyecto). No hace falta
   ninguna llave nueva: la administración del catálogo usa la misma sesión
   de empleado que `private/backend` (mismo `JWT_Secret_key`).

2. **Instala dependencias:**
   ```bash
   npm install
   ```

3. **Levanta el servidor:**
   ```bash
   npm run dev
   ```
   Por defecto corre en `http://localhost:4100`.

4. **Carga el catálogo inicial** — inicia sesión en `private/frontend` con
   cualquier empleado y ve a **Catálogo** en el menú lateral: ahí se crean
   los productos y se suben sus imágenes (ver más abajo). No hay script ni
   llamadas manuales a la API: el catálogo se administra desde esa pantalla,
   igual que cualquier otro dato del panel.

## Pagos con Wompi

Tokenización directa (ver `src/utils/wompiClient.js`): la tarjeta se tokeniza
y se cobra desde este mismo backend dentro de `POST /api/orders/checkout`, en
la misma petición — no hay enlace de pago, redirect ni webhook, así que no
hace falta exponer el backend con ningún túnel para probarlo en local.

Solo si Wompi aprueba el cobro se crea el pedido (ya con `paymentStatus:
"Pagado"`); si lo rechaza, no se crea nada y el cliente puede reintentar con
otra tarjeta desde el mismo checkout.

## Administración del catálogo

Se administra desde `private/frontend` (pantalla **Catálogo**, en el
Sidebar). No hay un mecanismo de auth aparte: estas rutas exigen la misma
cookie `authCookie` de sesión de empleado que usa todo el panel privado
(ver `src/middlewares/employeeAuthMiddleware.js`) — cualquier empleado ya
logueado en `private/frontend` puede usarlas.

- `POST /api/products` — crear producto
- `PUT /api/products/:id` — editar producto
- `DELETE /api/products/:id` — eliminar producto (borra también sus
  imágenes en Cloudinary)
- `POST /api/products/:id/images` — subir imágenes (multipart/form-data,
  campo `images`, hasta 6 por llamada)
- `DELETE /api/products/:id/images/:publicId` — eliminar una imagen

## Endpoints principales

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Crear cuenta de cliente |
| POST | `/api/auth/login` | — | Iniciar sesión |
| GET | `/api/products` | — | Catálogo (filtros `category`, `search`, `featured`) |
| GET | `/api/products/:slug` | — | Detalle de producto |
| POST | `/api/orders/checkout` | Cliente | Cobra la tarjeta con Wompi y, si aprueba, crea el pedido |
| GET | `/api/orders/mine` | Cliente | Historial de pedidos del cliente |
| POST | `/api/products` | Empleado | Crear producto |
| PUT | `/api/products/:id` | Empleado | Editar producto |
| DELETE | `/api/products/:id` | Empleado | Eliminar producto |
| POST | `/api/products/:id/images` | Empleado | Subir imágenes del producto |
| DELETE | `/api/products/:id/images/:publicId` | Empleado | Eliminar una imagen |
