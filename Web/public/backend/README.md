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
   credenciales de Wompi que ya tenía el proyecto).

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
   los productos y se suben sus imágenes (ver más abajo). Este backend no
   necesita estar corriendo para eso. No hay script ni
   llamadas manuales a la API: el catálogo se administra desde esa pantalla,
   igual que cualquier otro dato del panel.

## Correo (recuperación de contraseña)

`src/utils/mailer.js` envía los correos. En producción (Render gratis bloquea los
puertos SMTP) se usa la API HTTP de Brevo; en local, sin esa variable, se usa
SMTP de Gmail con `USER_EMAIL` / `USER_PASSWORD`. Al arrancar el log dice
«Correo: Brevo API» o «Correo: SMTP Gmail».

| Variable | Para qué |
| --- | --- |
| `BREVO_API_KEY` | Llave de la API de Brevo. Si existe, se envía por Brevo. |
| `MAIL_FROM` | Remitente (debe estar verificado en Brevo). Si falta, se usa `USER_EMAIL`. |
| `MAIL_FROM_NAME` | Nombre del remitente. Por defecto «Industrias Charly». |

## Pagos con Wompi

Tokenización directa (ver `src/utils/wompiClient.js`): la tarjeta se tokeniza
y se cobra desde este mismo backend dentro de `POST /api/orders/checkout`, en
la misma petición — no hay enlace de pago, redirect ni webhook, así que no
hace falta exponer el backend con ningún túnel para probarlo en local.

Solo si Wompi aprueba el cobro se crea el pedido (y su Ingreso en Finanzas);
si lo rechaza, no se crea nada y el cliente puede reintentar con otra tarjeta
desde el mismo checkout. Por eso todo pedido está pagado y `Order` no guarda
un estado de pago.

Los pedidos solo se crean aquí: el panel no crea ni edita pedidos, solo los
hace avanzar y puede eliminar los ya entregados. Al eliminarlos, el
`CustomerOrder` se conserva con un resumen del pedido (`snapshot`) y
«Mis pedidos» lo sigue mostrando.

## Modos de pago

La variable `PAYMENTS_MODE` decide cómo se procesa el pago del checkout
(`src/utils/payments.js`). El único paso que cambia es la llamada a Wompi:
validaciones, número de pedido, `Order`, `CustomerOrder`, venta en Finanzas y
novedades del panel se ejecutan con el mismo código en los tres modos.

| Valor | Comportamiento |
| --- | --- |
| `wompi` | Cobro real con Wompi (tokenización + cobro). Es el valor por defecto: si la variable no existe o tiene otro valor, se usa este. |
| `demo` | No se llama a Wompi en ningún paso (tampoco se precalienta el token al arrancar). El cobro se simula como aprobado al instante. La tienda pide la tarjeta como siempre, pero el backend la ignora y nunca se guarda. |
| `auto` | Autenticación y tokenización con Wompi con un presupuesto TOTAL de 5 s (`AUTO_MODE_PRECHARGE_BUDGET_MS`) y sin reintentos. Si fallan o no responden en ese tiempo (todavía no se cobró nada) el pago se simula, y el log dice «Pagos: Wompi no respondió antes del cobro (<paso>, <ms> ms); se simula el pago». Si la tokenización sale bien se cobra con Wompi (timeout de 20 s). **Si falla el cobro NO se simula**: queda `pendiente_conciliacion`, igual que en `wompi`, para no arriesgar un cobro doble. Si Wompi responde que los datos de la tarjeta no sirven (402), tampoco se simula: es una respuesta real. |

Al arrancar el log dice el modo activo (por ejemplo «Pagos: modo demo (no se
cobra con Wompi)»). El modo solo se ve en los logs del servidor: la tienda, el
panel y la app no muestran nada que distinga un pedido simulado de uno cobrado,
y el navegador no puede consultar el modo.

**Cambiar el modo en Render:** servicio `charly-public-backend` › *Environment* ›
agrega o edita `PAYMENTS_MODE` (`wompi`, `auto` o `demo`) › guarda; Render
reinicia el servicio solo. No hace falta tocar el frontend.

**Cómo se marcan los pedidos simulados:**

Solo con campos internos de la base, que ninguna pantalla muestra:

- `Order.paymentDemo: true`.
- `PaymentTransaction` con `status: "aprobado"`, `simulated: true` e
  `idTransaccion: "DEMO-<N° de pedido>"`; no lleva datos de la tarjeta.
- La venta en Finanzas lleva `paymentDemo: true`; su concepto es el mismo de una
  venta normal. Los reportes de Finanzas cuentan estas ventas como ingresos
  reales, así que para separarlas hay que filtrar por ese campo en la base.

Fuera de esas marcas, el pedido simulado se comporta igual que cualquier otro
(verificar, fabricar, empacar, rutas, entregar, eliminar…). Nada lo reembolsa
ni concilia, porque no hubo cobro.

## Administración del catálogo

Se administra desde `private/frontend` (pantalla **Catálogo**) y la app
Movil, contra `private/backend` (`/api/products`, con la sesión del panel).
Ambos backends usan la misma colección `products`, cada uno con su propia
copia del modelo (`src/models/Product.js`): este backend solo la lee, para
la tienda y para calcular los precios del checkout.

## Endpoints principales

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Crear cuenta de cliente |
| POST | `/api/auth/login` | — | Iniciar sesión |
| GET | `/api/products` | — | Catálogo (filtros `category`, `search`, `featured`) |
| GET | `/api/products/:slug` | — | Detalle de producto |
| POST | `/api/orders/checkout` | Cliente | Cobra la tarjeta con Wompi y, si aprueba, crea el pedido |
| GET | `/api/orders/mine` | Cliente | Historial de pedidos del cliente |
