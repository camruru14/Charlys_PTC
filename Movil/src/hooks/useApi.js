import { useCallback, useEffect, useRef, useState } from "react";
import { api as privateApi } from "../lib/api";

// Hook genérico de lectura (GET), mismo patrón que usePokemonData.js del
// proyecto de referencia: fetch dentro de try/catch/finally, estado de
// carga y una función para recargar a mano. Los hooks de cada dominio
// (useDashboard, useBatches, etc.) son wrappers finos sobre este, para no
// repetir el mismo try/catch/finally en cada uno.
//
// Distingue `loading` (primera carga, pantalla completa) de `refreshing`
// (recarga por pull-to-refresh, spinner nativo del FlatList/SectionList) —
// así una recarga manual no tapa la lista con el texto de "Cargando…".
//
// `refreshQuiet` es la lectura en segundo plano (useAutoRefresh): no toca
// `loading`, `refreshing` ni `error` (si falla se queda con lo que ya había) y no
// se lanza si ya hay una lectura en curso.
//
// Lecturas fuera de orden: toda lectura (la inicial, la de un cambio de `path`,
// pull-to-refresh o quiet) toma un número al empezar y su respuesta solo se
// aplica si sigue siendo la última. Una respuesta lenta nunca pisa a una más
// nueva (p. ej. la que sigue a una acción, o la del `path` con el rango actual).
// `loading` y `refreshing` se apagan cuando terminan todas las lecturas a la
// vista (las que no son quiet).
//
// `mutatePath` (Fase 3): ruta base para crear/actualizar/eliminar, si es
// distinta de la de lectura (ej. useCatalog lee de "/products/admin/all"
// pero crea/edita/borra contra "/products").
export function useApi(path, { client = privateApi, mutatePath } = {}) {
  const base = mutatePath || path;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // generation: sube con cada lectura; pending: lecturas en curso; visible: las que
  // no son quiet (mantienen `loading`/`refreshing` encendidos hasta que terminan todas).
  const generation = useRef(0);
  const pending = useRef(0);
  const visible = useRef(0);

  const load = useCallback(
    async ({ silent = false, quiet = false } = {}) => {
      if (quiet && pending.current > 0) return;
      const mine = ++generation.current;
      pending.current += 1;
      if (!quiet) {
        visible.current += 1;
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError(null);
      }

      try {
        const result = await client.get(path);
        if (mine !== generation.current) return;
        setData(result);
      } catch (e) {
        if (!quiet && mine === generation.current) setError(e.message || "No se pudo cargar la información");
      } finally {
        pending.current -= 1;
        if (!quiet) {
          visible.current -= 1;
          if (visible.current === 0) {
            setRefreshing(false);
            setLoading(false);
          }
        }
      }
    },
    [path, client],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Pull-to-refresh: recarga "silenciosa" (no vuelve a mostrar el texto de
  // carga inicial, solo el spinner nativo de RefreshControl).
  const refresh = useCallback(() => load({ silent: true }), [load]);
  const refreshQuiet = useCallback(() => load({ quiet: true }), [load]);

  // Crear/actualizar/eliminar (Fase 3): llaman al backend y, si sale bien,
  // recargan la lista — mismo criterio que `crearPedido` del proyecto de
  // referencia Applefly. Los errores se propagan tal cual (con su
  // `error.message` legible, ver src/lib/api.js) para que la pantalla de
  // formulario los muestre con Alert.alert.
  const crear = useCallback(
    async (body) => {
      const result = await client.post(base, body);
      await load({ silent: true });
      return result;
    },
    [client, base, load],
  );

  const actualizar = useCallback(
    async (id, body) => {
      const result = await client.put(`${base}/${id}`, body);
      await load({ silent: true });
      return result;
    },
    [client, base, load],
  );

  const eliminar = useCallback(
    async (id) => {
      const result = await client.del(`${base}/${id}`);
      await load({ silent: true });
      return result;
    },
    [client, base, load],
  );

  return { data, loading, refreshing, error, refresh, refreshQuiet, crear, actualizar, eliminar };
}

export default useApi;
