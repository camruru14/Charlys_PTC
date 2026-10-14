import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";

// Hook simple de datos: GET a `path` (o null para no disparar la petición),
// con refetch manual. `deps` re-dispara el fetch cuando cambia. Si llegan
// respuestas fuera de orden (cambió el path o se pidió de nuevo), solo cuenta la
// de la última petición: una respuesta vieja nunca pisa a una más nueva.
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState(null);
  // Contador de peticiones: cada una toma su número al empezar.
  const generation = useRef(0);

  const refetch = useCallback(async () => {
    if (!path) return;
    const mine = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path);
      if (mine === generation.current) setData(result);
    } catch (err) {
      if (mine === generation.current) setError(err);
    } finally {
      if (mine === generation.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch };
}

export default useFetch;
