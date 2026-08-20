import { useApi } from "./useApi";
import { useAuth } from "./useAuth";

// GET /employees/:id (private/backend), con el id del empleado que inició
// sesión: usado por AsistenciaScreen (Fase 4) para leer su propio historial
// de marcaciones (`attendance`). No usa useEmployees() de la Fase 2 (esa
// trae la lista completa de RRHH) porque acá solo hace falta un empleado.
export function useMyAttendance() {
  const { user } = useAuth();
  const { data, loading, refreshing, error, refresh } = useApi(`/employees/${user?.id}`);

  return {
    employee: data,
    attendance: Array.isArray(data?.attendance) ? data.attendance : [],
    loading,
    refreshing,
    error,
    refresh,
  };
}

export default useMyAttendance;
