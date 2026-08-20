import { useApi } from "./useApi";

// GET /employees (private/backend): empleados de RRHH.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// `actualizar` puede mandar `password` o no: el backend solo re-encripta la
// contraseña si viene en el body (ver employeesController.updateEmployee),
// así que EmpleadoFormScreen omite ese campo del payload cuando queda vacío.
export function useEmployees() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } =
    useApi("/employees");

  return {
    employees: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear,
    actualizar,
    eliminar,
  };
}

export default useEmployees;
