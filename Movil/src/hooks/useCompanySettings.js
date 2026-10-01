import { useCallback, useMemo } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";

// Ficha de la empresa (GET/PUT /settings/company, compartida por todos los
// usuarios) y su logo (POST /settings/company/logo, campo "logo"), como
// Configuracion.jsx de la web. El horario laboral está en useWorkSchedule.
export const COMPANY_FIELDS = ["name", "nit", "email", "phone", "address"];
export const DEFAULT_COMPANY = {
  name: "Industrias Charly",
  nit: "",
  email: "",
  phone: "",
  address: "",
  currency: "USD",
  logoUrl: null,
  updatedAt: null,
};

export function useCompanySettings() {
  const { data, loading, refreshing, error, refresh } = useApi("/settings/company");
  const company = useMemo(() => ({ ...DEFAULT_COMPANY, ...(data || {}) }), [data]);

  // Guarda los campos de texto (todos, como la web).
  const guardar = useCallback(
    async (fields) => {
      const result = await api.put("/settings/company", Object.fromEntries(COMPANY_FIELDS.map((k) => [k, fields[k] || ""])));
      await refresh();
      return result;
    },
    [refresh],
  );

  // file: { uri, name, type } de expo-image-picker.
  const subirLogo = useCallback(
    async (file) => {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await api.post("/settings/company/logo", formData);
      await refresh();
      return result;
    },
    [refresh],
  );

  return { company, ready: Boolean(data), loading, refreshing, error, refresh, guardar, subirLogo };
}

export default useCompanySettings;
