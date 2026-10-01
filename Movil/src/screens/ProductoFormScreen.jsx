import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import KeyboardScreen from "../components/ui/KeyboardScreen";
import { useCatalog } from "../hooks/useCatalog";
import ColorChips from "../components/catalog/ColorChips";
import ImageThumbRow from "../components/catalog/ImageThumbRow";
import BottomBar from "../components/ui/BottomBar";
import FormField from "../components/ui/FormField";
import Icon from "../components/ui/Icon";
import IconButton from "../components/ui/IconButton";
import LoadingState from "../components/ui/LoadingState";
import SelectField from "../components/ui/SelectField";
import SwitchField from "../components/ui/SwitchField";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { fonts } from "../lib/typography";
import { PRODUCT_CATEGORIES, catalogStatus } from "../lib/catalogOptions";
import { MAX_IMAGES_PER_UPLOAD, pickFromLibrary, pickPhotoSource, takePhoto } from "../lib/pickImages";
import { statusTone } from "../lib/statusTones";

const emptyForm = {
  name: "",
  category: "Pelotas",
  description: "",
  price: "",
  compareAtPrice: "",
  colors: [],
  minOrderQuantity: "1",
  stock: "0",
  featured: false,
  active: true,
  images: [],
};

// Precio: dígitos y hasta 2 decimales (step="0.01" en la web), sin signo.
function cleanPrice(v) {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [int, ...rest] = s.split(".");
  return rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
}
const onlyDigits = (v) => v.replace(/\D/g, "");

function PhotoButton({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.photoButton, pressed && styles.photoPressed]}
    >
      <Icon name={icon} size={22} color={colors.primary} />
      <Text style={styles.photoText}>{label}</Text>
    </Pressable>
  );
}

// Crear o editar un producto del catálogo, con los mismos campos, payload y
// validaciones que ProductFormModal.jsx / pages/Catalogo.jsx de la web. Las
// fotos nuevas se encolan y se suben después de guardar el producto (igual
// que la web); las ya subidas se borran al momento con su «x». Eliminar el
// producto está en el «···» del encabezado.
export default function ProductoFormScreen({ navigation, route }) {
  const id = route.params?.id;
  const isEditing = Boolean(id);
  const toast = useToast();

  const { products, loading, crear, actualizar, eliminar, agregarImagenes, eliminarImagen } = useCatalog();

  const [form, setForm] = useState(isEditing ? null : emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [removingImageId, setRemovingImageId] = useState(null);

  const product = isEditing ? products.find((p) => p._id === id) : null;

  useEffect(() => {
    if (!isEditing || form) return;
    if (product) {
      setForm({
        name: product.name || "",
        category: product.category || "Pelotas",
        description: product.description || "",
        price: product.price != null ? String(product.price) : "",
        compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : "",
        colors: product.colors || [],
        minOrderQuantity: String(product.minOrderQuantity ?? 1),
        stock: String(product.stock ?? 0),
        featured: Boolean(product.featured),
        active: product.active !== false,
        images: product.images || [],
      });
      return;
    }
    if (!loading) {
      Alert.alert("No se encontró el producto", "Puede que ya haya sido eliminado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  }, [isEditing, form, product, loading, navigation]);

  const confirmDelete = useCallback(() => {
    if (!product) return;
    Alert.alert("Eliminar producto", `¿Eliminar "${product.name}"? También se borran sus imágenes en Cloudinary.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(product._id);
            toast.show("Producto eliminado");
            navigation.goBack();
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);
  }, [product, eliminar, navigation, toast]);

  useLayoutEffect(() => {
    if (!isEditing) {
      navigation.setOptions({
        title: "Nuevo producto",
        headerBackTitle: "Catálogo",
        headerSubtitle: "Todo lo que ve el cliente en la tienda",
      });
      return;
    }
    if (!product) return;
    const status = catalogStatus(product);
    const nColors = product.colors?.length || 0;
    navigation.setOptions({
      title: product.name,
      headerBackTitle: "Catálogo",
      headerStatus: { label: status, tone: statusTone(status, "catalogo") },
      headerSubtitle: [product.category, nColors ? `${nColors} ${nColors === 1 ? "color" : "colores"}` : "sin colores"]
        .filter(Boolean)
        .join(" · "),
      headerRight: () => (
        <IconButton
          icon="more"
          accessibilityLabel="Más acciones del producto"
          onPress={() =>
            Alert.alert(product.name, undefined, [
              { text: "Eliminar producto", style: "destructive", onPress: confirmDelete },
              { text: "Cancelar", style: "cancel" },
            ])
          }
        />
      ),
    });
  }, [navigation, isEditing, product, confirmDelete]);

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Máximo 6 fotos por subida (límite del backend).
  const room = MAX_IMAGES_PER_UPLOAD - pendingFiles.length;
  const queue = (files) => {
    if (files?.length) setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES_PER_UPLOAD));
  };
  const addPhotos = async (source) => {
    if (room <= 0) {
      Alert.alert("Máximo de fotos", `Se pueden subir hasta ${MAX_IMAGES_PER_UPLOAD} fotos a la vez. Guarda y agrega más después.`);
      return;
    }
    if (source === "camera") queue(await takePhoto());
    else if (source === "library") queue(await pickFromLibrary(room));
    else queue(await pickPhotoSource(room));
  };

  const handleRemoveImage = async (publicId) => {
    setRemovingImageId(publicId);
    try {
      await eliminarImagen(id, publicId);
      setForm((f) => ({ ...f, images: f.images.filter((img) => img.publicId !== publicId) }));
    } catch (err) {
      Alert.alert("No se pudo quitar la imagen", err.message);
    } finally {
      setRemovingImageId(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Falta información", "Escribe el nombre del producto");
      return;
    }
    if (form.price === "") {
      Alert.alert("Falta información", "Escribe el precio");
      return;
    }
    if (form.minOrderQuantity !== "" && Number(form.minOrderQuantity) < 1) {
      Alert.alert("Revisa el mínimo", "La cantidad mínima de pedido debe ser al menos 1");
      return;
    }
    setSaving(true);
    // Mismo payload que pages/Catalogo.jsx (el nombre va tal cual).
    const { images, ...rest } = form;
    const payload = {
      ...rest,
      price: Number(form.price) || 0,
      compareAtPrice: form.compareAtPrice === "" ? undefined : Number(form.compareAtPrice) || 0,
      minOrderQuantity: Number(form.minOrderQuantity) || 1,
      stock: Number(form.stock) || 0,
    };

    let productId = id;
    try {
      if (isEditing) {
        await actualizar(id, payload);
      } else {
        const created = await crear(payload);
        productId = created?._id;
      }
    } catch (err) {
      Alert.alert("No se pudo guardar", err.message || "Intenta de nuevo");
      setSaving(false);
      return;
    }

    try {
      if (pendingFiles.length && productId) await agregarImagenes(productId, pendingFiles);
      toast.show(isEditing ? "Producto actualizado" : "Producto creado");
      navigation.goBack();
    } catch (err) {
      // El producto ya quedó guardado: no se vuelve a crear, solo se avisa.
      Alert.alert(
        isEditing ? "Producto actualizado" : "Producto creado",
        `Pero no se pudieron subir las fotos: ${err.message}. Súbelas desde el Catálogo con «Subir foto».`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <LoadingState />;

  const categories = PRODUCT_CATEGORIES.includes(form.category)
    ? PRODUCT_CATEGORIES
    : [...PRODUCT_CATEGORIES, form.category];

  return (
    <View style={styles.screen}>
      <KeyboardScreen style={styles.flex} contentContainerStyle={styles.content}>
        {isEditing ? (
          <ImageThumbRow
            images={form.images}
            pending={pendingFiles}
            removingId={removingImageId}
            onRemove={handleRemoveImage}
            onRemovePending={(i) => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
            onAdd={() => addPhotos()}
          />
        ) : (
          <>
            <View style={styles.photoButtons}>
              <PhotoButton icon="camera" label="Tomar foto" onPress={() => addPhotos("camera")} />
              <PhotoButton icon="grid" label="Elegir de galería" onPress={() => addPhotos("library")} />
            </View>
            {pendingFiles.length ? (
              <ImageThumbRow
                pending={pendingFiles}
                onRemovePending={(i) => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
              />
            ) : null}
          </>
        )}

        <FormField
          label="Nombre"
          value={form.name}
          onChangeText={(v) => handleChange("name", v)}
          placeholder="Ej. Pelota plástica 40 mm"
          required
        />
        <SelectField
          label="Categoría"
          value={form.category}
          options={categories.map((c) => ({ label: c, value: c }))}
          onChange={(v) => handleChange("category", v)}
          required
        />
        <FormField
          label="Descripción"
          value={form.description}
          onChangeText={(v) => handleChange("description", v)}
          multiline
        />
        <View style={styles.columns}>
          <FormField
            label="Precio ($)"
            value={form.price}
            onChangeText={(v) => handleChange("price", cleanPrice(v))}
            keyboardType="decimal-pad"
            placeholder="0.00"
            required
            style={styles.column}
          />
          <FormField
            label="Precio antes ($)"
            value={form.compareAtPrice}
            onChangeText={(v) => handleChange("compareAtPrice", cleanPrice(v))}
            keyboardType="decimal-pad"
            placeholder="Sin descuento"
            style={styles.column}
          />
        </View>
        <View style={styles.columns}>
          <FormField
            label="Mínimo de pedido"
            value={form.minOrderQuantity}
            onChangeText={(v) => handleChange("minOrderQuantity", onlyDigits(v))}
            keyboardType="number-pad"
            suffix="u"
            style={styles.column}
          />
          <FormField
            label="Existencia"
            value={form.stock}
            onChangeText={(v) => handleChange("stock", onlyDigits(v))}
            keyboardType="number-pad"
            suffix="u"
            style={styles.column}
          />
        </View>
        <ColorChips value={form.colors} onChange={(v) => handleChange("colors", v)} />
        <SwitchField
          label="Destacado"
          description="Aparece en el Inicio de la tienda"
          value={form.featured}
          onValueChange={(v) => handleChange("featured", v)}
        />
        <SwitchField label="Visible en la tienda" value={form.active} onValueChange={(v) => handleChange("active", v)} />
      </KeyboardScreen>

      <BottomBar
        note={pendingFiles.length ? `${pendingFiles.length} ${pendingFiles.length === 1 ? "foto se sube" : "fotos se suben"} al guardar` : undefined}
        actions={
          isEditing
            ? [{ title: "Guardar cambios", loading: saving, onPress: handleSave }]
            : [
                { title: "Cancelar", variant: "secondary", disabled: saving, onPress: () => navigation.goBack() },
                { title: "Crear producto", loading: saving, onPress: handleSave },
              ]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  photoButtons: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoButton: {
    flex: 1,
    height: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primarySoft,
    backgroundColor: colors.selectBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoPressed: { backgroundColor: colors.primarySoft },
  photoText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },
});
