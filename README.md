# 🏭 PlastiGest - Industrias Charly

> **Transformando la materia prima en eficiencia operativa.**

PlastiGest es una plataforma web desarrollada para **Industrias Charly**, diseñada para optimizar el proceso de producción, inventario, ventas y administración empresarial mediante una solución moderna, segura y fácil de utilizar.

---

# 👥 Equipo de Desarrollo

| Integrante | Rol |
|------------|-----|
| **Camila Rugamas** | Coordinadora |
| **David Iglesias** | Subcoordinador |
| **Carlos Salinas** | Secretario |
| **Gabriel Ramírez** | Tesorero |
| **Isaac Ramos** | Vocal |

---

# 🚀 Características Principales

### 📦 Gestión de Inventario
- Control de materia prima.
- Administración de productos terminados.
- Registro de movimientos de inventario.

### 🏭 Producción
- Seguimiento de lotes de fabricación.
- Control del estado de producción.
- Historial de procesos productivos.

### 💰 Ventas
- Gestión de pedidos.
- Registro de transacciones.
- Reportes de ventas.

### 👥 Usuarios y Seguridad
- Autenticación mediante JWT.
- Roles de usuario:
  - Administrador
  - Empleado
  - Cliente
- Protección de rutas.

---

# 📁 Convenciones de Nomenclatura

Para mantener un proyecto limpio y fácil de mantener, se siguen las siguientes convenciones.

## Backend

| Elemento | Convención | Ejemplo |
|----------|------------|----------|
| Archivos | camelCase | `authController.js` |
| Rutas | camelCase | `inventoryRoutes.js` |
| Controladores | camelCase | `employeeController.js` |
| Funciones | camelCase | `handleLogin()` |
| Variables | camelCase | `isAuthenticated` |

---

## Frontend

| Elemento | Convención | Ejemplo |
|----------|------------|----------|
| Componentes | PascalCase | `Dashboard.jsx` |
| Páginas | PascalCase | `Inventory.jsx` |
| Hooks | camelCase | `useAuth.js` |
| Contextos | camelCase | `authContext.js` |
| Variables | camelCase | `selectedBatch` |

---

## Base de Datos

Los modelos se nombran utilizando **PascalCase** y en **singular**.

Ejemplos:

- Employee
- InventoryItem
- Order
- ProductionBatch
- Transaction

---

# ⚙️ Requisitos Previos

Antes de ejecutar el proyecto asegúrese de tener instalado:

- Node.js 18 o superior
- npm
- MongoDB Atlas
- Archivo `.env` configurado en:
  - Backend
  - Frontend

---

#  Ejecución del Proyecto

##  Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
```

---

##  Backend

Ingresar al proyecto:

```bash
cd private/backend
```

Instalar dependencias:

```bash
npm install
```

Iniciar servidor:

```bash
npm run dev
```

Servidor disponible en:

```
http://localhost:4000
```

---

##  Frontend

Abrir una nueva terminal.

Ingresar al proyecto:

```bash
cd private/frontend
```

Instalar dependencias:

```bash
npm install
```

Iniciar Vite:

```bash
npm run dev
```

Aplicación disponible en:

```
http://localhost:5173
```

---

# 💻 Backend

## Tecnologías

- Node.js
- Express
- MongoDB Atlas
- Mongoose

---

## Dependencias

| Librería | Descripción |
|----------|-------------|
| Express | Framework principal de la API |
| Mongoose | Conexión y modelado de MongoDB |
| JSON Web Token | Autenticación mediante JWT |
| bcryptjs | Encriptación de contraseñas |
| dotenv | Variables de entorno |
| cors | Comunicación Frontend-Backend |
| cookie-parser | Manejo de cookies |
| express-rate-limit | Protección contra ataques |
| multer | Carga de archivos |
| multer-storage-cloudinary | Almacenamiento en Cloudinary |
| cloudinary | Gestión de imágenes |
| nodemailer | Envío de correos |
| node-fetch | Consumo de APIs |
| crypto | Funciones criptográficas |

### Desarrollo

- Nodemon

---

## Arquitectura

### Controllers

- Auth
- Dashboard
- Employees
- Inventory
- Orders
- ProductionBatches
- Transactions

### Models

- Employee
- InventoryItem
- Order
- ProductionBatch
- Transaction

### Routes

- Auth
- Dashboard
- Employees
- Inventory
- Orders
- ProductionBatches
- Transactions

### Middlewares

- Auth
- Rate Limiter

---

#  Frontend

## Tecnologías

- React
- Vite
- Tailwind CSS

---

## Dependencias

| Librería | Descripción |
|----------|-------------|
| React | Biblioteca para interfaces |
| React DOM | Renderizado del DOM |
| React Router DOM | Navegación entre páginas |
| React Hot Toast | Notificaciones |
| Tailwind CSS | Framework CSS |
| @tailwindcss/vite | Integración de Tailwind con Vite |

### Desarrollo

- Vite
- @vitejs/plugin-react

---

## Hooks

- useAuth
- useFetch

---

## Contextos

- AuthContext
- DateRangeContext

---

## Componentes Base

- Layout
- Sidebar
- TopBar
- PrivateRoute

---

## Componentes Reutilizables

- Modal
- Button
- Field
- StatusPill
- KpiCard
- DonutChart
- BarChart
- DateRangePicker

---

## Componentes de Negocio

- BatchTable
- BatchToolbar
- TransactionTable
- TransactionToolbar

---

## Páginas

- Dashboard
- Login
- Empleados
- Fabricación
- Inventario
- Pedidos
- Finanzas
- Logística
- Historial de Lotes
- Historial de Transacciones
- Configuración

---

#  Librerías e Integraciones

- Axios
- Cloudinary
- JWT
- MongoDB Atlas
- Tailwind CSS
- React Router DOM
- React Hot Toast

---

#  Estructura General

```
private
│
├── backend
│   ├── controllers
│   ├── middlewares
│   ├── models
│   ├── routes
│   ├── config
│   └── server.js
│
└── frontend
    ├── src
    │   ├── components
    │   ├── context
    │   ├── hooks
    │   ├── pages
    │   ├── layouts
    │   └── assets
    └── vite.config.js
```

---

# 🔒 Seguridad

El sistema incorpora:

- Autenticación mediante JWT.
- Encriptación de contraseñas con bcrypt.
- Protección de rutas privadas.
- Limitación de peticiones HTTP.
- Variables de entorno mediante `.env`.

---

#  Licencia

Proyecto desarrollado exclusivamente para **Industrias Charly** con fines académicos.

---

<div align="center">

##  PlastiGest

**Sistema de Control de Producción y Gestión Comercial**

**Desarrollado para Industrias Charly**

© 2026 Todos los derechos reservados.

</div>
