import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from "react-native";
import { useCatalog } from "../hooks/useCatalog";
import ProductActionsSheet from "../components/catalog/ProductActionsSheet";
import ProductCard from "../components/catalog/ProductCard";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import FilterChips from "../components/ui/FilterChips";
import IconButton from "../components/ui/IconButton";
import KpiInline from "../components/ui/KpiInline";
import LoadingState from "../components/ui/LoadingState";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";
import { formatNumber } from "../lib/format";
import { pickPhotoSource } from "../lib/pickImages";
import { statusTone } from "../lib/statusTones";
import { useBottomPad } from "../hooks/useBottomPad";

const ALL = "__all";

// Catálogo de la tienda en línea (Web/private/frontend/src/pages/Catalogo.jsx):
// indicadores, chips por categoría (las que existen, con su conteo) y la
// cuadrícula de productos. Tocar un producto abre sus acciones: editar,
// subir foto, destacado, visible y eliminar.
export default function CatalogoScreen({ navigation }) {
  const bottomPad = useBottomPad(32);
  const toast = useToast();
  // Dos columnas: (ancho - márgenes de 20 - separación de 10) / 2.
  const cardWidth = (useWindowDimensions().width - 40 - 10) / 2;
  const { products, loading, refreshing, error, refresh, actualizar, eliminar, agregarImagenes } = useCatalog();
  const [category, setCategory] = useState(ALL);
  const [selected, setSelected] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="plus"
          variant="primary"
          onPress={() => navigation.navigate("ProductoForm")}
          accessibilityLabel="Nuevo producto"
        />
      ),
    });
  }, [navigation]);

  // Chips: «Todas» y cada categoría que existe, con su conteo (como las
  // pestañas de la web).
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const chips = [
    { value: ALL, label: "Todas", count: products.length },
    ...categories.map((c) => ({ value: c, label: c, count: products.filter((p) => p.category === c).length })),
  ];
  const current = category !== ALL && categories.includes(category) ? category : ALL;
  const filtered = current === ALL ? products : products.filter((p) => p.category === current);

  const kpis = {
    total: products.length,
    active: products.filter((p) => p.active !== false).length,
    featured: products.filter((p) => p.featured).length,
  };

  const confirmDelete = (product) =>
    Alert.alert("Eliminar producto", `¿Eliminar "${product.name}"? También se borran sus imágenes en Cloudinary.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await eliminar(product._id);
            toast.show("Producto eliminado");
          } catch (err) {
            Alert.alert("No se pudo eliminar", err.message);
          }
        },
      },
    ]);

  // Subida rápida sin abrir el formulario (handleAddImagesFromCard en la web).
  const uploadPhotos = async (product) => {
    const files = await pickPhotoSource();
    if (!files?.length) return;
    setUploadingId(product._id);
    try {
      await agregarImagenes(product._id, files);
      toast.show(files.length === 1 ? "Imagen agregada" : "Imágenes agregadas");
    } catch (err) {
      Alert.alert("No se pudieron subir las imágenes", err.message);
    } finally {
      setUploadingId(null);
    }
  };

  // Destacado y visible: los mismos campos del formulario, con el mismo PUT.
  const toggle = async (product, field) => {
    const next = field === "featured" ? !product.featured : product.active === false;
    try {
      await actualizar(product._id, { [field]: next });
      if (field === "featured") toast.show(next ? `${product.name} destacado` : `${product.name} ya no es destacado`);
      else toast.show(next ? `${product.name} visible en la tienda` : `${product.name} oculto de la tienda`);
    } catch (err) {
      Alert.alert("No se pudo actualizar", err.message);
    }
  };

  const handleAction = (action, product) => {
    if (action === "edit") navigation.navigate("ProductoForm", { id: product._id });
    else if (action === "upload") uploadPhotos(product);
    else if (action === "featured" || action === "active") toggle(product, action);
    else if (action === "delete") confirmDelete(product);
  };

  if (loading && !products.length) return <LoadingState />;
  if (error && !products.length) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.content, bottomPad]}
        data={filtered}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        ListHeaderComponent={
          <View style={styles.header}>
            <KpiInline
              items={[
                { label: "Productos", value: formatNumber(kpis.total), tone: "blue" },
                { label: "Activos", value: formatNumber(kpis.active), tone: statusTone("Activo", "catalogo") },
                { label: "Destacados", value: formatNumber(kpis.featured), tone: statusTone("Destacado", "catalogo") },
              ]}
            />
            <FilterChips options={chips} value={current} onChange={setCategory} />
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            style={{ width: cardWidth }}
            uploading={uploadingId === item._id}
            onPress={() => setSelected(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="tag"
            message={
              products.length
                ? "No hay productos en esta categoría."
                : "No hay productos todavía. Crea el primero con «+»."
            }
          />
        }
      />

      <ProductActionsSheet product={selected} onClose={() => setSelected(null)} onAction={handleAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  header: { gap: 12, marginBottom: 12 },
  columns: { gap: 10, marginBottom: 10 },
});
