import { useCallback, useEffect, useState } from "react";
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
// `mutatePath` (Fase 3): ruta base para crear/actualizar/eliminar, si es
// distinta de la de lectura (ej. useCatalog lee de "/products/admin/all"
// pero crea/edita/borra contra "/products").
export function useApi(path, { client = privateApi, mutatePath } = {}) {
  const base = mutatePath || path;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const result = await client.get(path);
        setData(result);
      } catch (e) {
        setError(e.message || "No se pudo cargar la información");
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
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

  return { data, loading, refreshing, error, refresh, crear, actualizar, eliminar };
}

export default useApi;
