import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

// Fotos de producto con expo-image-picker. Devuelven archivos { uri, name,
// type } listos para el FormData de POST /products/:id/images (campo
// "images"), o null si se canceló o no hay permiso.

// Máximo de imágenes por request, mismo límite que
// Web/private/backend/src/routes/products.js (uploadProductImages.array("images", 6)).
export const MAX_IMAGES_PER_UPLOAD = 6;

const toFiles = (assets) =>
  assets.map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName || `imagen-${Date.now()}-${index}.jpg`,
    type: asset.mimeType || "image/jpeg",
  }));

export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permiso necesario", "Se necesita acceso a la cámara para tomar fotos de los productos.");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;
  return toFiles(result.assets);
}

export async function pickFromLibrary(limit = MAX_IMAGES_PER_UPLOAD) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permiso necesario", "Se necesita acceso a la galería para elegir imágenes.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(limit, 1),
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  return toFiles(result.assets.slice(0, Math.max(limit, 1)));
}

// Pregunta «Cámara o galería» y devuelve los archivos elegidos (o null).
export function pickPhotoSource(limit = MAX_IMAGES_PER_UPLOAD) {
  return new Promise((resolve) => {
    Alert.alert(
      "Subir foto",
      undefined,
      [
        { text: "Tomar foto", onPress: () => takePhoto().then(resolve, () => resolve(null)) },
        { text: "Elegir de galería", onPress: () => pickFromLibrary(limit).then(resolve, () => resolve(null)) },
        { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
