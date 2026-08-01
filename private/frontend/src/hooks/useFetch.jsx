import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/*
  Hook genérico de lectura (GET) con estado de carga, error y refetch.
  Uso:
    const { data, loading, error, refetch } = useFetch("/orders");
*/
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
}

export default useFetch;
