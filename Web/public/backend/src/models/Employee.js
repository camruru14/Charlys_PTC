import { Schema, model } from "mongoose";

// IMPORTANTE: este esquema es una copia intencional del modelo Employee del
// panel privado (private/backend/src/models/Employee.js), igual que se hizo
// con Order.js. Ambos backends apuntan a la MISMA base de datos y a la MISMA
// colección "employees" — este backend NO crea ni edita empleados, solo lo
// usa para: (1) que employeeAuthMiddleware.js pueda validar la cookie
// "authCookie" de un empleado ya logueado en private/frontend y administrar
// así el catálogo público, y (2) que "Employee" quede registrado como modelo
// aquí también, para poder poblar (`.populate`) el motorista de un pedido
// (Order.delivery.driver) el día que se necesite.
//
// Si se modifica el esquema en el panel privado, este archivo debe
// actualizarse igual para que ambos lados sigan siendo compatibles.

const attendanceSchema = new Schema(
  {
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    overtimeHours: { type: Number, default: 0 },
    workedHours: { type: Number, default: 0 },
  },
  { _id: false },
);

const employeeSchema = new Schema(
  {
    name: { type: String, required: true },
    lastName: { type: String, required: true },
    dui: { type: String },
    phone: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    position: { type: String },
    department: {
      type: String,
      enum: ["Fabricación", "Logística", "Administración", "Almacén", "Finanzas"],
    },
    hourlyRate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    hireDate: { type: Date, default: Date.now },
    attendance: [attendanceSchema],
  },
  { timestamps: true },
);

export default model("Employee", employeeSchema);
