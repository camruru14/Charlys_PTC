import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import * as ImagePicker from "expo-image-picker";
import { useCatalog } from "../hooks/useCatalog";
import { useSaveCancelHeader } from "../hooks/useSaveCancelHeader";
import FormField from "../components/ui/FormField";
import SegmentedField from "../components/ui/SegmentedField";
import SwitchField from "../components/ui/SwitchField";
import CustomButton from "../components/ui/CustomButton";
import DeleteButton from "../components/ui/DeleteButton";
import LoadingState from "../components/ui/LoadingState";
import ColorChips from "../components/catalog/ColorChips";
import ImageThumbRow from "../components/catalog/ImageThumbRow";
import { colors } from "../lib/theme";

const CATEGORIES = ["Pelotas", "Pajillas"];
// Máximo de imágenes por request, mismo límite que
// Web/public/backend/src/routes/products.js (uploadProductImages.array("images", 6)).
const MAX_IMAGES_PER_UPLOAD = 6;

const emptyForm = {
  name: "",
  category: "Pelotas",
  description: "",
  price: "",
  compareAtPrice: "",
  minOrderQuantity: "1",
  stock: "0",
  colors: [],
  featured: false,
  active: true,
  images: [],
};

// Crear/editar un producto del catálogo público. El slug lo genera el
// backend solo. Las imágenes nuevas —tanto al crear como al editar— se
// encolan en `pendingFiles` y se suben recién en handleSave, después de que
// el guardado del producto tuvo éxito: mismo orden que sigue
// ProductFormModal.jsx en el panel web (ver `pendingFiles` + handleSubmit en
// pages/Catalogo.jsx). Si el usuario cancela sin guardar, esas fotos nunca
// se suben, igual que en la web.
export default function ProductoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);

  const {
    products,
    loading: productsLoading,
    crear,
    actualizar,
    eliminar,
    agregarImagenes,
    eliminarImagen,
  } = useCatalog();

  const [form, setForm] = useState(emptyForm);
  const [loaded, setLoaded] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [removingImageId, setRemovingImageId] = useState(null);

  useEffect(() => {
    if (!isEditing || loaded) return;
    const product = products.find((p) => p._id === id);
    if (product) {
      setForm({
        name: product.name || "",
        category: product.category || "Pelotas",
        description: product.description || "",
        price: product.price != null ? String(product.price) : "",
        compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : "",
        minOrderQuantity: product.minOrderQuantity != null ? String(product.minOrderQuantity) : "1",
        stock: product.stock != null ? String(product.stock) : "0",
        colors: product.colors || [],
        featured: Boolean(product.featured),
        active: product.active !== false,
        images: product.images || [],
      });
      setLoaded(true);
      return;
    }
    if (!productsLoading) {
      Alert.alert("No se encontró el producto", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, loaded, id, products, productsLoading, navigation]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso necesario", "Se necesita acceso a la galería para elegir imágenes");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES_PER_UPLOAD,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const files = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `imagen-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || "image/jpeg",
    }));

    setPendingFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveImage = async (publicId) => {
    setRemovingImageId(publicId);
    try {
      await eliminarImagen(id, publicId);
      setForm((f) => ({ ...f, images: f.images.filter((img) => img.publicId !== publicId) }));
    } catch (error) {
      Alert.alert("No se pudo eliminar la imagen", error.message || "Intentá de nuevo");
    } finally {
      setRemovingImageId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Falta información", "El nombre es obligatorio");
      return;
    }
    if (!form.price) {
      Alert.alert("Falta información", "El precio es obligatorio");
      return;
    }
    setSaving(true);
    // Igual que pages/Catalogo.jsx en la web: el nombre se manda tal cual lo
    // escribió el usuario, sin recortar espacios.
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      price: Number(form.price) || 0,
      compareAtPrice: form.compareAtPrice === "" ? undefined : Number(form.compareAtPrice) || 0,
      colors: form.colors,
      minOrderQuantity: Number(form.minOrderQuantity) || 1,
      stock: Number(form.stock) || 0,
      featured: form.featured,
      active: form.active,
    };
    try {
      let targetId = id;
      if (isEditing) {
        await actualizar(id, payload);
      } else {
        const created = await crear(payload);
        targetId = created?._id;
      }
      if (pendingFiles.length && targetId) {
        await agregarImagenes(targetId, pendingFiles);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intentá de nuevo");
    } finally {
      setSaving(false);
    }
  };

  useSaveCancelHeader({
    navigation,
    title: isEditing ? "Editar producto" : "Nuevo producto",
    saving,
    onSave: handleSave,
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eliminar(id);
      navigation.goBack();
    } catch (error) {
      setDeleting(false);
      Alert.alert("No se pudo eliminar", error.message || "Intentá de nuevo");
    }
  };

  if (isEditing && !loaded) return <LoadingState />;

  return (
    <KeyboardScreen style={styles.container} contentContainerStyle={styles.content}>
      <FormField
        label="Nombre"
        value={form.name}
        onChangeText={(v) => handleChange("name", v)}
        placeholder="Ej. Pelota plástica 40 mm"
        required
      />
      <SegmentedField
        label="Categoría"
        value={form.category}
        options={CATEGORIES}
        onChange={(v) => handleChange("category", v)}
      />
      <FormField
        label="Descripción"
        value={form.description}
        onChangeText={(v) => handleChange("description", v)}
        multiline
      />
      <FormField
        label="Precio ($)"
        value={form.price}
        onChangeText={(v) => handleChange("price", v)}
        keyboardType="numeric"
        required
      />
      <FormField
        label="Precio antes ($) — opcional"
        value={form.compareAtPrice}
        onChangeText={(v) => handleChange("compareAtPrice", v)}
        keyboardType="numeric"
        placeholder="Sin descuento"
      />
      <FormField
        label="Cantidad mínima de pedido"
        value={form.minOrderQuantity}
        onChangeText={(v) => handleChange("minOrderQuantity", v)}
        keyboardType="numeric"
      />
      <FormField
        label="Existencia mostrada en la tienda"
        value={form.stock}
        onChangeText={(v) => handleChange("stock", v)}
        keyboardType="numeric"
      />
      <ColorChips value={form.colors} onChange={(v) => handleChange("colors", v)} />
      <SwitchField label="Destacado (aparece en Inicio)" value={form.featured} onValueChange={(v) => handleChange("featured", v)} />
      <SwitchField label="Visible en la tienda" value={form.active} onValueChange={(v) => handleChange("active", v)} />

      {isEditing && form.images.length > 0 ? (
        <Text style={styles.label}>Imágenes actuales</Text>
      ) : null}
      {isEditing ? (
        <ImageThumbRow images={form.images} onRemove={handleRemoveImage} removingId={removingImageId} />
      ) : null}

      <Text style={[styles.label, styles.addImagesLabel]}>
        {isEditing ? "Agregar imágenes" : "Imágenes (opcional)"}
      </Text>
      <CustomButton title="Agregar imágenes" onPress={handlePickImages} variant="secondary" />
      {pendingFiles.length ? (
        <Text style={styles.hint}>{pendingFiles.length} imagen(es) lista(s) para subir al guardar.</Text>
      ) : null}

      {isEditing ? (
        <DeleteButton
          confirmMessage={`¿Eliminar "${form.name}"? También se borran sus imágenes en Cloudinary.`}
          onConfirm={handleDelete}
          disabled={deleting}
          label={deleting ? "Eliminando…" : "Eliminar"}
        />
      ) : null}
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate700,
    marginBottom: 8,
  },
  addImagesLabel: {
    marginTop: 4,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.slate500,
  },
});
