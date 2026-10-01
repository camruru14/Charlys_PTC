import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// Mi cuenta: datos de quien tiene la sesión abierta (GET/PUT /auth/me:
// teléfono y DUI) y el cambio de correo o contraseña (PUT
// /auth/me/credentials, que exige la contraseña actual), como Mi cuenta en
// Configuracion.jsx de la web.
export function useAccount() {
  const { data, loading, refreshing, error, refresh } = useApi("/auth/me");

  // { phone, dui }
  const guardarPerfil = useCallback(
    async (fields) => {
      const result = await api.put("/auth/me", fields);
      await refresh();
      return result;
    },
    [refresh],
  );

  // { email?, newPassword?, currentPassword }
  const cambiarAcceso = useCallback(
    async (body) => {
      const result = await api.put("/auth/me/credentials", body);
      await refresh();
      return result;
    },
    [refresh],
  );

  return { account: data, loading, refreshing, error, refresh, guardarPerfil, cambiarAcceso };
}

export default useAccount;
