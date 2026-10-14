import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";
import { useAuth } from "./useAuth";

// Mi cuenta: datos de quien tiene la sesión abierta (GET/PUT /auth/me:
// nombre, apellido, teléfono y DUI) y su foto (POST/DELETE /auth/me/photo) y el cambio de correo o contraseña (PUT
// /auth/me/credentials, que exige la contraseña actual), como Mi cuenta en
// Configuracion.jsx de la web.
//
// storedPassword: la contraseña propia para «Contraseña actual» (GET
// /auth/me/password -> { password, legacy }). Vive solo en el estado de la
// pantalla que usa el hook (memoria): no se guarda en disco ni se reutiliza
// entre sesiones.
export function useAccount() {
  const { updateUser } = useAuth();
  const { data, loading, refreshing, error, refresh } = useApi("/auth/me");
  const {
    data: passwordData,
    loading: passwordLoading,
    error: passwordError,
    refresh: refreshPassword,
  } = useApi("/auth/me/password");

  // { name?, lastName?, phone?, dui? }
  const guardarPerfil = useCallback(
    async (fields) => {
      const result = await api.put("/auth/me", fields);
      // Si el backend entregó un token nuevo, se guarda ANTES de volver a pedir la cuenta.
      if (result?.token) await updateUser({}, result.token);
      await refresh();
      return result;
    },
    [refresh, updateUser],
  );

  // Foto de perfil, al momento. file: { uri, name, type } de expo-image-picker;
  // las dos responden la cuenta con el photoUrl nuevo.
  const subirFoto = useCallback(
    async (file) => {
      const formData = new FormData();
      formData.append("photo", file);
      const result = await api.post("/auth/me/photo", formData);
      await refresh();
      return result;
    },
    [refresh],
  );

  const quitarFoto = useCallback(async () => {
    const result = await api.del("/auth/me/photo");
    await refresh();
    return result;
  }, [refresh]);

  // { email?, newPassword?, currentPassword }
  const cambiarAcceso = useCallback(
    async (body) => {
      const result = await api.put("/auth/me/credentials", body);
      // Cambiar el correo o la contraseña cierra las demás sesiones y renueva esta:
      // el token nuevo se guarda ANTES de volver a pedir la cuenta (con el viejo daría 401).
      if (result?.token) await updateUser({}, result.token);
      await refresh();
      return result;
    },
    [refresh, updateUser],
  );

  return {
    account: data,
    loading,
    refreshing,
    error,
    refresh,
    guardarPerfil,
    subirFoto,
    quitarFoto,
    cambiarAcceso,
    storedPassword: passwordData || null,
    storedPasswordLoading: passwordLoading,
    storedPasswordError: passwordError,
    refreshStoredPassword: refreshPassword,
  };
}

export default useAccount;
