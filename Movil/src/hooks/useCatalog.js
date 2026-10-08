import { useCallback } from "react";
import { useApi } from "./useApi";
import { api } from "../lib/api";
import { refreshProductNames } from "./useProductNames";

// Administración del catálogo contra private/backend (src/lib/api.js, con el
// token de la sesión), igual que el panel web. Lee de "/products/admin/all"
// pero crea/edita/borra contra "/products" (mutatePath), que es donde vive el
// resto de la API de productos.
export function useCatalog() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi(
    "/products/admin/all",
    { mutatePath: "/products" },
  );

  // Crear, editar o eliminar cambia la lista de nombres de producto que usan
  // los selectores (useProductNames): se vuelve a pedir tras cada cambio. Las
  // funciones se mantienen estables (los formularios las usan en dependencias).
  const crearYRefrescar = useCallback(
    async (...args) => {
      const result = await crear(...args);
      refreshProductNames();
      return result;
    },
    [crear],
  );
  const actualizarYRefrescar = useCallback(
    async (...args) => {
      const result = await actualizar(...args);
      refreshProductNames();
      return result;
    },
    [actualizar],
  );
  const eliminarYRefrescar = useCallback(
    async (...args) => {
      const result = await eliminar(...args);
      refreshProductNames();
      return result;
    },
    [eliminar],
  );

  // Sube hasta 6 imágenes (multipart/form-data, campo "images") a un
  // producto que ya existe. `files` son objetos { uri, name, type } que
  // entrega expo-image-picker.
  const agregarImagenes = useCallback(
    async (id, files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const result = await api.post(`/products/${id}/images`, formData);
      await refresh();
      return result;
    },
    [refresh],
  );

  // Borra una imagen ya subida (también la borra de Cloudinary, del lado
  // del backend). `publicId` va URL-encoded, igual que en el panel web.
  const eliminarImagen = useCallback(
    async (id, publicId) => {
      const result = await api.del(`/products/${id}/images/${encodeURIComponent(publicId)}`);
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    products: Array.isArray(data) ? data : [],
    loading,
    refreshing,
    error,
    refresh,
    crear: crearYRefrescar,
    actualizar: actualizarYRefrescar,
    eliminar: eliminarYRefrescar,
    agregarImagenes,
    eliminarImagen,
  };
}

export default useCatalog;
