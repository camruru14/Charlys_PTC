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

  // Carga inicial y cada vez que cambia la ruta (ej. el rango de fechas del
  // Dashboard). Los setState van en callbacks de la promesa, no en el cuerpo
  // del efecto; `ignore` descarta una respuesta vieja si la ruta cambió antes.
  useEffect(() => {
    let ignore = false;
    client
      .get(path)
      .then((result) => {
        if (ignore) return;
        setData(result);
        setError(null);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [path, client]);

  return { data, loading, error, refetch: load };
}

export default useFetch;
