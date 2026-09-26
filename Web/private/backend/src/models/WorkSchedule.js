import { Schema, model } from "mongoose";

// Horario laboral de la empresa (un solo documento). Configuración > Empresa
// lo edita y Empleados lo usa para calcular las marcaciones tardías (entrada
// después de startTime) y las horas extra (por encima de workdayHours).
export const DEFAULT_WORK_SCHEDULE = { startTime: "07:00", workdayHours: 8 };

const workScheduleSchema = new Schema(
  {
    // Hora de entrada, "HH:MM" (24 h)
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: DEFAULT_WORK_SCHEDULE.startTime,
    },
    workdayHours: {
      type: Number,
      required: true,
      min: 0,
      max: 24,
      default: DEFAULT_WORK_SCHEDULE.workdayHours,
    },
  },
  {
    timestamps: true,
  },
);

export default model("WorkSchedule", workScheduleSchema);
