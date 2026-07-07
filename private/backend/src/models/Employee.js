import { Schema, model } from "mongoose";

// Sub-esquema para el registro de asistencia diario (marcaciones de la app móvil)
const attendanceSchema = new Schema(
  {
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    // Horas extra calculadas para esa jornada
    overtimeHours: { type: Number, default: 0 },
    workedHours: { type: Number, default: 0 },
  },
  { _id: false },
);

const employeeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    dui: {
      type: String,
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "gerente", "operario", "motorista"],
      default: "operario",
    },
    position: {
      type: String,
    },
    department: {
      type: String,
      enum: [
        "Fabricación",
        "Logística",
        "Administración",
        "Almacén",
        "Finanzas",
      ],
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    hireDate: {
      type: Date,
      default: Date.now,
    },
    attendance: [attendanceSchema],
  },
  {
    timestamps: true,
  },
);

export default model("Employee", employeeSchema);
