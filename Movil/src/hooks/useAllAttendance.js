import { useMemo } from "react";
import { useEmployees } from "./useEmployees";

// Aplana el array `attendance` de cada empleado (ya viene en la respuesta de
// GET /employees) en una sola lista de marcaciones con el empleado incluido,
// ordenada por fecha descendente — mismo criterio que RRHH en el panel web
// (pages/Empleados.jsx, tab Asistencia). No pega a ningún endpoint nuevo:
// solo reorganiza los datos que useEmployees ya trae.
export function useAllAttendance() {
  const { employees, loading, refreshing, error, refresh } = useEmployees();

  const records = useMemo(() => {
    const all = [];
    for (const employee of employees) {
      const fullName = `${employee.name || ""} ${employee.lastName || ""}`.trim();
      for (const record of employee.attendance || []) {
        all.push({ ...record, employeeId: employee._id, employeeName: fullName });
      }
    }
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [employees]);

  return { records, employees, loading, refreshing, error, refresh };
}

export default useAllAttendance;
