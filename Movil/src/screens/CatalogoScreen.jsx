import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from "react-native";
import { useCatalog } from "../hooks/useCatalog";
import ProductCard from "../components/catalog/ProductCard";
import KpiTile from "../components/dashboard/KpiTile";
import SegmentedField from "../components/ui/SegmentedField";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import FloatingAddButton from "../components/ui/FloatingAddButton";
import { colors } from "../lib/theme";

const CATEGORY_FILTERS = ["Todas", "Pelotas", "Pajillas"];

export default function CatalogoScreen({ navigation }) {
  const { products, loading, refreshing, error, refresh, agregarImagenes } = useCatalog();
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [uploadingId, setUploadingId] = useState(null);

  // Recarga la lista cada vez que la pantalla vuelve a tener foco (ej. al
  // volver de crear/editar/eliminar un producto en el modal).
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Subida rápida desde la card, sin abrir el formulario de edición —
  // mismo criterio que handleAddImagesFromCard en la web
  // (Web/private/frontend/src/pages/Catalogo.jsx). `agregarImagenes` ya
  // refresca la lista sola (ver useCatalog.js).
  const handleAddImagesFromCard = async (product, files) => {
    setUploadingId(product._id);
    try {
      await agregarImagenes(product._id, files);
    } catch (err) {
      Alert.alert("No se pudieron subir las imágenes", err.message || "Intentá de nuevo");
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error && products.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  // Los KPIs se calculan sobre `products` completo, sin el filtro de
  // categoría de abajo — mismo criterio que la web.
  const kpis = {
    total: products.length,
    active: products.filter((p) => p.active !== false).length,
    featured: products.filter((p) => p.featured).length,
  };

  const filtered =
    categoryFilter === "Todas" ? products : products.filter((p) => p.category === categoryFilter);

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={filtered}
        keyExtractor={(item, index) => item._id || item.slug || String(index)}
        ListHeaderComponent={
          <View>
            <View style={styles.kpiGrid}>
              <KpiTile label="Productos" value={kpis.total} hint="en catálogo" />
              <KpiTile label="Visibles" value={kpis.active} hint="en la tienda" />
              <KpiTile label="Destacados" value={kpis.featured} hint="en Inicio" />
            </View>
            <SegmentedField
              label="Categoría"
              value={categoryFilter}
              options={CATEGORY_FILTERS}
              onChange={setCategoryFilter}
            />
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("ProductoForm", { id: item._id })}
          >
            <ProductCard
              product={item}
              onAddImages={handleAddImagesFromCard}
              uploading={uploadingId === item._id}
            />
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={<EmptyState message="No hay productos en el catálogo todavía" />}
      />
      <FloatingAddButton onPress={() => navigation.navigate("ProductoForm")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
    flexGrow: 1,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
});
