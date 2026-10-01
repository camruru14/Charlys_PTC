import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "../lib/api";

// Subcategorías de producto (Configuración > Subcategorías), como
// hooks/useSubcategories.js de la web. El nombre de una subcategoría es el
// «producto» que usa todo el sistema (pedidos, lotes, producción diaria,
// Producto Terminado).
//   const { subcategories, all } = useSubcategories();
//   const { subcategories } = useSubcategories({ includeInactive: false });
//   - all: todas, con { _id, name, category, active, inUse }.
//   - subcategories: `all`, o solo las activas con includeInactive: false.
//   - crear({ name, category }), actualizar(id, { name?, category?, active? })
//     (PATCH) y eliminar(id). Una subcategoría que ya se usa en registros no se
//     puede renombrar, cambiar de categoría ni eliminar (solo desactivar): el
//     backend responde 409 con el motivo.
// Caché simple a nivel de módulo: todas las pantallas comparten la misma lista,
// que se muestra al instante si ya se cargó y se vuelve a pedir al montar.
// Varias peticiones a la vez se comparten en una sola.
export const SUBCATEGORY_CATEGORIES = ["Pajillas", "Pelotas"];

const EMPTY = [];
const store = {
  state: { data: null, loading: false, refreshing: false, error: null },
  listeners: new Set(),
  inflight: null,
};

const emit = (patch) => {
  store.state = { ...store.state, ...patch };
  store.listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
};
const getSnapshot = () => store.state;

function fetchNow() {
  const hasData = store.state.data != null;
  emit({ loading: !hasData, refreshing: hasData, error: null });
  store.inflight = api
    .get("/subcategories")
    .then((data) => emit({ data: Array.isArray(data) ? data : [], loading: false, refreshing: false }))
    .catch((err) => emit({ error: err.message || "No se pudo cargar la información", loading: false, refreshing: false }))
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

// Pide la lista; si ya hay una petición en curso la comparte.
export function loadSubcategories() {
  return store.inflight || fetchNow();
}

// Vuelve a pedir la lista después de un cambio: si hay una petición en curso,
// espera a que termine para no quedarse con datos anteriores al cambio.
export function refreshSubcategories() {
  return store.inflight ? store.inflight.then(fetchNow) : fetchNow();
}

export function useSubcategories({ includeInactive = true } = {}) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    loadSubcategories();
  }, []);

  const all = snapshot.data || EMPTY;
  const subcategories = useMemo(() => (includeInactive ? all : all.filter((s) => s.active)), [all, includeInactive]);

  const crear = useCallback(async (body) => {
    const result = await api.post("/subcategories", body);
    await refreshSubcategories();
    return result;
  }, []);
  const actualizar = useCallback(async (id, changes) => {
    const result = await api.patch(`/subcategories/${id}`, changes);
    await refreshSubcategories();
    return result;
  }, []);
  const eliminar = useCallback(async (id) => {
    const result = await api.del(`/subcategories/${id}`);
    await refreshSubcategories();
    return result;
  }, []);

  return {
    subcategories,
    all,
    loading: snapshot.loading && !snapshot.data,
    refreshing: snapshot.refreshing,
    error: snapshot.error,
    refresh: refreshSubcategories,
    crear,
    actualizar,
    eliminar,
  };
}

const sameName = (a, b) => String(a).trim().toLocaleLowerCase("es") === String(b).trim().toLocaleLowerCase("es");

// Categoría ("Pajillas" | "Pelotas") de la subcategoría con ese nombre, o ""
// si no existe (p. ej. un registro anterior a las subcategorías: «Pajilla»).
export function categoryOfProduct(subcategories, name) {
  if (!name) return "";
  return subcategories.find((s) => sameName(s.name, name))?.category || "";
}

// Nombres que se pueden elegir para una categoría: solo las activas, más el
// producto que el registro ya tiene aunque esté desactivado (o sea anterior a
// las subcategorías), para no perderlo al editar.
export function productOptions(subcategories, category, current) {
  const names = category ? subcategories.filter((s) => s.category === category && s.active).map((s) => s.name) : [];
  if (!current || names.some((n) => sameName(n, current))) return names;
  return categoryOfProduct(subcategories, current) === category ? [...names, current] : names;
}

// Igual que productOptions, para el formulario de un producto del Catálogo.
export function subcategoryOptions(subcategories, category, current) {
  const names = subcategories.filter((s) => s.category === category && s.active).map((s) => s.name);
  return current && !names.includes(current) && subcategories.some((s) => s.name === current && s.category === category)
    ? [...names, current]
    : names;
}

export default useSubcategories;
