import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/*
  Hook genérico de lectura (GET) con estado de carga, error y refetch.
  Uso:
    const { data, loading, error, refetch } = useFetch("/orders");
  Por defecto pega a private/backend (lib/api.js). Para leer de otro backend
  (ej. Catálogo.jsx contra public/backend) pasa `client`:
    useFetch("/products", { client: publicApi });
*/
export function useFetch(path, { client = api } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.get(path);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path, client]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

export default useFetch;
