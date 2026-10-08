import { useEffect, useSyncExternalStore } from "react";
import { api } from "../lib/api";

// Los productos del Catálogo (GET /products/names), como
// hooks/useProductNames.js de la web. El nombre de un producto es el
// «producto» que usa todo el sistema (pedidos, lotes, producción diaria,
// Producto Terminado): el Catálogo es la única fuente. Incluye los inactivos:
// `active` solo controla si se ven en la tienda.
//   const { products } = useProductNames();
//   - products: [{ _id, name, category, active, inUse }], por categoría y
//     nombre. `inUse`: el nombre ya se usa en pedidos, lotes o inventario (no
//     se puede renombrar, cambiar de categoría ni eliminar).
// Caché simple a nivel de módulo: todas las pantallas comparten la misma lista,
// que se muestra al instante si ya se cargó y se vuelve a pedir al montar.
// Varias peticiones a la vez se comparten en una sola. useCatalog la refresca
// después de crear, editar o eliminar un producto.
export const PRODUCT_NAME_CATEGORIES = ["Pajillas", "Pelotas"];

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
    .get("/products/names")
    .then((data) => emit({ data: Array.isArray(data) ? data : [], loading: false, refreshing: false }))
    .catch((err) => emit({ error: err.message || "No se pudo cargar la información", loading: false, refreshing: false }))
    .finally(() => {
      store.inflight = null;
    });
  return store.inflight;
}

// Pide la lista; si ya hay una petición en curso la comparte.
export function loadProductNames() {
  return store.inflight || fetchNow();
}

// Vuelve a pedir la lista después de un cambio: si hay una petición en curso,
// espera a que termine para no quedarse con datos anteriores al cambio.
export function refreshProductNames() {
  return store.inflight ? store.inflight.then(fetchNow) : fetchNow();
}

export function useProductNames() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    loadProductNames();
  }, []);

  return {
    products: snapshot.data || EMPTY,
    loading: snapshot.loading && !snapshot.data,
    refreshing: snapshot.refreshing,
    error: snapshot.error,
    refresh: refreshProductNames,
  };
}

// Mismo criterio que el índice único del backend: sin distinguir mayúsculas
// ni espacios sobrantes.
export const normalizeName = (name) => String(name ?? "").trim().replace(/\s+/g, " ");
export const sameName = (a, b) => normalizeName(a).toLocaleLowerCase("es") === normalizeName(b).toLocaleLowerCase("es");

// Categoría ("Pajillas" | "Pelotas") del producto con ese nombre, o "" si no
// existe (p. ej. un registro anterior al Catálogo único: «Pajilla»).
export function categoryOfProduct(products, name) {
  if (!name) return "";
  return products.find((p) => sameName(p.name, name))?.category || "";
}

// Nombres que se pueden elegir para una categoría: todos los productos del
// Catálogo de esa categoría (activos o no), más el producto que el registro ya
// tiene aunque ya no exista (o sea anterior al Catálogo único), para no
// perderlo al editar.
export function productOptions(products, category, current) {
  const names = category ? products.filter((p) => p.category === category).map((p) => p.name) : [];
  if (!current || names.some((n) => sameName(n, current))) return names;
  return categoryOfProduct(products, current) === category ? [...names, current] : names;
}

export default useProductNames;
