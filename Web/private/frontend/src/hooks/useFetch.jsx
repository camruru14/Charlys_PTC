import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

/*
  Hook genérico de lectura (GET) con estado de carga, error, refetch y mutate.
  Uso:
    const { data, loading, error, refetch, mutate } = useFetch("/orders");
  Por defecto pega a private/backend (lib/api.js). Para leer con otro cliente
  HTTP pasa `client` (un objeto con `get(path)`):
    useFetch("/ruta", { client: otroCliente });
  - refetch() vuelve a pedir la ruta. Si ya hay datos, no pasa por «Cargando…»
    (la pantalla se queda como está hasta que llega la respuesta).
  - mutate(updater) cambia los datos locales sin pedir nada al servidor, p. ej.
    para reemplazar un registro con la respuesta de una acción
    (ver replaceById).
*/
export function useFetch(path, { client = api } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    setError(null);
    try {
      const result = await client.get(path);
      hasData.current = true;
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path, client]);

  const mutate = useCallback((updater) => setData((prev) => (typeof updater === "function" ? updater(prev) : updater)), []);

  // Carga inicial y cada vez que cambia la ruta (ej. el rango de fechas del
  // Dashboard). Los setState van en callbacks de la promesa, no en el cuerpo
  // del efecto; `ignore` descarta una respuesta vieja si la ruta cambió antes.
  useEffect(() => {
    let ignore = false;
    client
      .get(path)
      .then((result) => {
        if (ignore) return;
        hasData.current = true;
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

  return { data, loading, error, refetch: load, mutate };
}

// Reemplaza en una lista los registros que llegan actualizados (por _id).
export function replaceById(list, updated) {
  if (!Array.isArray(list)) return list;
  const byId = new Map((Array.isArray(updated) ? updated : [updated]).filter(Boolean).map((d) => [String(d._id), d]));
  if (!byId.size) return list;
  return list.map((item) => byId.get(String(item._id)) || item);
}

export default useFetch;
