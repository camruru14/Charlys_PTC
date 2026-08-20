import { useCallback } from "react";
import { useApi } from "./useApi";
import { publicApi } from "../lib/publicApi";

// GET /products/admin/all (public/backend): requiere el token de empleado,
// que src/lib/publicApi.js ya manda como Authorization: Bearer (Fase 1).
// Lee de "/products/admin/all" pero crea/edita/borra contra "/products"
// (mutatePath), que es donde vive el resto de la API de productos.
export function useCatalog() {
  const { data, loading, refreshing, error, refresh, crear, actualizar, eliminar } = useApi(
    "/products/admin/all",
    { client: publicApi, mutatePath: "/products" },
  );

  // Sube hasta 6 imágenes (multipart/form-data, campo "images") a un
  // producto que ya existe. `files` son objetos { uri, name, type } que
  // entrega expo-image-picker.
  const agregarImagenes = useCallback(
    async (id, files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("images", file));
      const result = await publicApi.post(`/products/${id}/images`, formData, { isForm: true });
      await refresh();
      return result;
    },
    [refresh],
  );

  // Borra una imagen ya subida (también la borra de Cloudinary, del lado
  // del backend). `publicId` va URL-encoded, igual que en el panel web.
  const eliminarImagen = useCallback(
    async (id, publicId) => {
      const result = await publicApi.del(`/products/${id}/images/${encodeURIComponent(publicId)}`);
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
    crear,
    actualizar,
    eliminar,
    agregarImagenes,
    eliminarImagen,
  };
}

export default useCatalog;
