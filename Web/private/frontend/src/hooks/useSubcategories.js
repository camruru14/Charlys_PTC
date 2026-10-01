import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "../lib/api";

/*
  Subcategorías de producto (Configuración > Subcategorías). El nombre de una
  subcategoría es el «producto» que usa todo el sistema (pedidos, lotes,
  producción diaria, Producto Terminado).
    const { subcategories, all } = useSubcategories();
    const { subcategories } = useSubcategories({ includeInactive: false });
  - all: todas, con { _id, name, category, active, inUse }.
  - subcategories: `all`, o solo las activas con includeInactive: false.

  Caché simple a nivel de módulo: todas las pantallas comparten la misma
  lista, que se muestra al instante si ya se cargó y se vuelve a pedir al
  montar (así un cambio hecho en Configuración llega a los formularios).
  Varias peticiones a la vez se comparten en una sola.
*/
export const SUBCATEGORY_CATEGORIES = ["Pajillas", "Pelotas"];

const EMPTY = [];
const store = { state: { data: null, loading: false, error: null }, listeners: new Set(), inflight: null };

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
  emit({ loading: store.state.data == null, error: null });
  store.inflight = api
    .get("/subcategories")
    .then((data) => emit({ data: Array.isArray(data) ? data : [], loading: false }))
    .catch((err) => emit({ error: err.message, loading: false }))
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

// Pide la lista; si ya hay una petición en curso la comparte.
export function loadSubcategories() {
  return store.inflight || fetchNow();
}

// Vuelve a pedir la lista después de un cambio (crear, editar, eliminar): si
// hay una petición en curso, espera a que termine para no quedarse con datos
// anteriores al cambio.
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
  return { subcategories, all, loading: snapshot.loading && !snapshot.data, error: snapshot.error, refetch: refreshSubcategories };
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
  const currentCategory = categoryOfProduct(subcategories, current);
  return currentCategory === category ? [...names, current] : names;
}

// Nombres que se pueden elegir para una categoría en el formulario de un
// producto del Catálogo (mismo criterio: activas + la actual si está inactiva).
export function subcategoryOptions(subcategories, category, current) {
  const names = subcategories.filter((s) => s.category === category && s.active).map((s) => s.name);
  return current && !names.includes(current) && subcategories.some((s) => s.name === current && s.category === category)
    ? [...names, current]
    : names;
}

export default useSubcategories;
