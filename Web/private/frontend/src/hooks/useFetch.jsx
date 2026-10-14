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
  - refetch({ silent: true }) es el refresco en segundo plano (useAutoRefresh):
    no cambia loading ni error (si falla se queda con lo que ya había) y no se
    lanza si ya hay una lectura en curso.
  - mutate(updater) cambia los datos locales sin pedir nada al servidor, p. ej.
    para reemplazar un registro con la respuesta de una acción
    (ver replaceById).
  Un mutate() mientras hay una lectura en curso (p. ej. de una ruta nueva) la invalida, así que al
  terminar esa lectura se lanza una lectura silenciosa para no quedarse con datos de la ruta anterior.
  Un mutate(fn) durante la carga inicial (aún no hay datos) no aplica fn a null: la lectura posterior
  trae todo.
  Lecturas fuera de orden: toda lectura (la inicial, la de un cambio de ruta,
  refetch() y refetch({ silent: true })) toma un número al empezar y su
  respuesta solo se aplica si sigue siendo la última lectura y no hubo un
  mutate() después. Una respuesta lenta nunca pisa a una más nueva ni a un
  mutate(). `loading` se apaga cuando terminan todas las lecturas a la vista.
*/
export function useFetch(path, { client = api } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasData = useRef(false);
  // generation: sube con cada lectura y cada mutate; pending: lecturas en curso;
  // visible: las que no son silenciosas (las que mantienen `loading`).
  const generation = useRef(0);
  const pending = useRef(0);
  const visible = useRef(0);
  // Un mutate() invalidó una lectura en curso: al terminar, se vuelve a leer en silencio.
  const reloadAfter = useRef(false);
  const loadRef = useRef(null);

  const load = useCallback(
    async (options) => {
      // refetch suele pasarse como callback (onSaved={refetch}): solo importa { silent: true }.
      const silent = options?.silent === true;
      if (silent && pending.current > 0) return;
      const mine = ++generation.current;
      pending.current += 1;
      if (!silent) {
        visible.current += 1;
        if (!hasData.current) setLoading(true);
        setError(null);
      }
      try {
        const result = await client.get(path);
        if (mine !== generation.current) return;
        hasData.current = true;
        setData(result);
      } catch (e) {
        if (!silent && mine === generation.current) setError(e.message);
      } finally {
        pending.current -= 1;
        if (!silent) {
          visible.current -= 1;
          if (visible.current === 0) setLoading(false);
        }
        // Un mutate() descartó la respuesta de esta lectura: se vuelve a pedir lo actual (de la ruta actual).
        if (pending.current === 0 && reloadAfter.current) {
          reloadAfter.current = false;
          // Sin datos todavía (carga inicial) la recarga no es silenciosa: así se ve «Cargando…»
          // en vez de la lista vacía y, si falla, se muestra el error.
          loadRef.current?.(hasData.current ? { silent: true } : undefined);
        }
      }
    },
    [path, client],
  );

  // La `load` más reciente (la de la ruta actual) para la lectura de arriba.
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const mutate = useCallback((updater) => {
    generation.current += 1;
    // Había una lectura en curso: su respuesta ya no se aplicará (generación vieja), hay que repetirla.
    if (pending.current > 0) reloadAfter.current = true;
    if (typeof updater === "function") {
      // Sin datos todavía (carga inicial): no hay nada que transformar; no se deja updater(null).
      if (!hasData.current) return;
      setData((prev) => updater(prev));
      return;
    }
    hasData.current = true;
    setData(updater);
  }, []);

  // Carga inicial y cada vez que cambia la ruta (ej. el rango de fechas del
  // Dashboard): la misma `load` que refetch, así su respuesta compite con las
  // demás por el número de lectura (la de la ruta anterior queda descartada).
  // Se lanza en un microtask para que los setState no vayan en el cuerpo del efecto.
  useEffect(() => {
    queueMicrotask(() => load());
  }, [load]);

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
