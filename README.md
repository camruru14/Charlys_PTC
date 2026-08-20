# 🏭 Industrias Charly

> **Transformando la materia prima en eficiencia operativa.** ⚙️

Una solución integral diseñada para optimizar el ciclo de vida de producción y la gestión comercial de **Industrias Charly**.

---

### 👥 Equipo de Desarrollo (Integrantes)
| Nombre | Rol |
| :--- | :--- |
| 👨‍💻 **Camila Rugamas** | Coordinadora |
| 👨‍💻 **David Iglesias** | SubCoordinador |
| 👨‍💻 **Carlos Salinas** | Secretario |
| 👨‍💻 **Gabriel Ramirez** | Tesorero |
| 👨‍💻 **Isaac Ramos** | Vocal |

---

### ✨ Características Principales
* **📦 Gestión de Inventario:** Control total de producción y productos terminados.
* **🏗️ Control de Producción:** Monitoreo ventas y producciones al día de la fábrica.
* **📈 Ventas:** Seguimiento de pedidos y reportes mensuales de las ventas.
* **👥 Usuarios & Roles:** Seguridad basada en perfiles (Administrador, Empleados, Clientes).
* **🛒 Tienda en línea:** Catálogo público, carrito, cuentas de cliente y pago con tarjeta
  vía Wompi (`public/backend` + `public/frontend`). Los pedidos de la tienda caen en la
  misma base de datos que usa el panel privado, así que aparecen directo en
  Pedidos / Inventario / Logística sin pasos manuales.

---

## Estructura del proyecto

```
Industrias Charly/
├── private/            Panel administrativo (empleados)
│   ├── backend/         Express + MongoDB
│   └── frontend/        React + Vite (PlastiGest)
└── public/              Tienda pública (clientes)
    ├── backend/          Express + MongoDB + Cloudinary + Wompi
    └── frontend/         React + Vite
```

Cada carpeta (`private/backend`, `private/frontend`, `public/backend`,
`public/frontend`) tiene su propio `README.md`/`.env` y corre de forma
independiente. `public` y `private` comparten la misma base de datos MongoDB.

---
*© 2026 - PlastiGest para Industrias Charly. Todos los derechos reservados.*
