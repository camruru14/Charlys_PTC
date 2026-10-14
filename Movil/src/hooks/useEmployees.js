import { useCallback } from "react";
import { useApi } from "./useApi";
import { useAuth } from "./useAuth";
import { api } from "../lib/api";

// GET /employees (private/backend): empleados de RRHH.
// crear/actualizar/eliminar (Fase 3): POST, PUT y DELETE al mismo recurso.
// `actualizar` puede mandar `password` o no: el backend solo re-encripta la
// contraseña si viene en el body (ver employeesController.updateEmployee),
// así que EmpleadoFormScreen omite ese campo del payload cuando queda vacío.
// Solo un administrador crea, edita (a cualquiera) y elimina; el backend lo exige
// (routes/employees.js) y las pantallas ocultan esas acciones a los demás.
export function useEmployees() {
  const { updateUser } = useAuth();
  const { data, loading, refreshing, error, refresh, crear, eliminar } =
    useApi("/employees");

  // Igual que `actualizar` de useApi, pero si el backend entrega un token nuevo
  // (un administrador que cambia SU contraseña conserva así su sesión) se guarda
  // ANTES de recargar la lista: con el token viejo la recarga daría 401.
  const actualizar = useCallback(
    async (id, body) => {
      const result = await api.put(`/employees/${id}`, body);
      if (result?.token) await updateUser({}, result.token);
      await refresh();
      return result;
    },
    [refresh, updateUser],
  );

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
