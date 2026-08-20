import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useVehicles } from "../hooks/useVehicles";
import { useWarehouses } from "../hooks/useWarehouses";
import KpiTile from "../components/dashboard/KpiTile";
import SimpleListCard from "../components/logistics/SimpleListCard";
import Card from "../components/ui/Card";
import FormField from "../components/ui/FormField";
import ErrorState from "../components/ui/ErrorState";
import LoadingState from "../components/ui/LoadingState";
import EmptyState from "../components/ui/EmptyState";
import { colors } from "../lib/theme";

// Igual que en Web/private/frontend/src/pages/Configuracion.jsx: no hay
// modelo/endpoint de backend para "Datos de la empresa" todavía, así que se
// guarda localmente. Misma clave que usa la web en localStorage, por si el
// día de mañana se comparte lógica.
const COMPANY_STORAGE_KEY = "charly:company-info";
const EMPTY_COMPANY = { name: "Industrias Charly", email: "", phone: "", address: "" };

// El CRUD de Bodegas y Vehículos vivía en LogisticaScreen.jsx; en el panel
// web ese CRUD en realidad vive en Configuración (Logística es la
// asignación de motoristas/vehículos a pedidos, fase posterior), así que se
// movió acá tal cual.
export default function ConfiguracionScreen({ navigation }) {
  const {
    vehicles,
    loading: vehiclesLoading,
    refreshing: vehiclesRefreshing,
    error: vehiclesError,
    refresh: refreshVehicles,
  } = useVehicles();
  const {
    warehouses,
    loading: warehousesLoading,
    refreshing: warehousesRefreshing,
    error: warehousesError,
    refresh: refreshWarehouses,
  } = useWarehouses();

  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(COMPANY_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          setCompany({ ...EMPTY_COMPANY, ...JSON.parse(raw) });
        } catch {
          // ignora datos corruptos y se queda con el valor por defecto
        }
      })
      .catch(() => {});
  }, []);

  const handleCompanyChange = (field, value) => {
    setCompany((c) => ({ ...c, [field]: value }));
  };

  const handleCompanySave = async () => {
    setSavingCompany(true);
    try {
      await AsyncStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
      Alert.alert("Guardado", "Datos de la empresa guardados");
    } catch (error) {
      Alert.alert("No se pudo guardar", error.message || "Intentá de nuevo");
    } finally {
      setSavingCompany(false);
    }
  };

  const loading = vehiclesLoading || warehousesLoading;
  const refreshing = vehiclesRefreshing || warehousesRefreshing;
  const refresh = () => {
    refreshVehicles();
    refreshWarehouses();
  };

  // Recarga ambas listas cada vez que la pantalla vuelve a tener foco (ej.
  // al volver de crear/editar/eliminar un vehículo o bodega en el modal).
  useFocusEffect(
    useCallback(() => {
      refreshVehicles();
      refreshWarehouses();
    }, [refreshVehicles, refreshWarehouses]),
  );

  if (loading) return <LoadingState />;

  if ((vehiclesError && vehicles.length === 0) || (warehousesError && warehouses.length === 0)) {
    return <ErrorState message={vehiclesError || warehousesError} onRetry={refresh} />;
  }

  const sections = [
    {
      key: "warehouses",
      title: "Bodegas",
      description:
        "Estas son las bodegas disponibles en Inventario, en el modal de verificación de pedidos y en los reportes de Fabricación.",
      data:
        warehouses.length > 0
          ? warehouses
          : [{ __placeholder: true, message: warehousesError || "No hay bodegas registradas." }],
    },
    {
      key: "vehicles",
      title: "Vehículos",
      description:
        "Estos son los vehículos disponibles para elegir en Logística al asignar o editar una entrega.",
      data:
        vehicles.length > 0
          ? vehicles
          : [{ __placeholder: true, message: vehiclesError || "No hay vehículos registrados." }],
    },
  ];

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(item, index) => item._id || item.plate || item.name || `placeholder-${index}`}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <View style={styles.kpiGrid}>
            <KpiTile label="Bodegas configuradas" value={warehouses.length} />
            <KpiTile label="Vehículos configurados" value={vehicles.length} />
            <KpiTile label="Empresa" value={company.name || "—"} />
          </View>

          <Text style={styles.sectionTitle}>Datos de la empresa</Text>
          <Card>
            <FormField
              label="Nombre de la empresa"
              value={company.name}
              onChangeText={(v) => handleCompanyChange("name", v)}
              placeholder="Industrias Charly"
              required
            />
            <FormField
              label="Correo"
              value={company.email}
              onChangeText={(v) => handleCompanyChange("email", v)}
              placeholder="contacto@industriascharly.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              label="Teléfono"
              value={company.phone}
              onChangeText={(v) => handleCompanyChange("phone", v)}
              placeholder="0000-0000"
              keyboardType="phone-pad"
            />
            <FormField
              label="Dirección"
              value={company.address}
              onChangeText={(v) => handleCompanyChange("address", v)}
              placeholder="Dirección de la empresa"
            />
            <TouchableOpacity
              style={[styles.saveButton, savingCompany && styles.saveButtonDisabled]}
              onPress={handleCompanySave}
              disabled={savingCompany}
              activeOpacity={0.85}
              hitSlop={4}
            >
              <Text style={styles.saveButtonText}>
                {savingCompany ? "Guardando…" : "Guardar datos de la empresa"}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <TouchableOpacity
              style={styles.sectionAddButton}
              onPress={() =>
                navigation.navigate(section.key === "warehouses" ? "BodegaForm" : "VehiculoForm")
              }
              hitSlop={10}
            >
              <Text style={styles.sectionAddText}>
                {section.key === "warehouses" ? "+ Agregar bodega" : "+ Agregar vehículo"}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDescription}>{section.description}</Text>
        </View>
      )}
      renderItem={({ item, section }) => {
        if (item.__placeholder) {
          return <EmptyState message={item.message} />;
        }
        const target = section.key === "warehouses" ? "BodegaForm" : "VehiculoForm";
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate(target, { id: item._id })}
          >
            <SimpleListCard label={item.name || item.plate} />
          </TouchableOpacity>
        );
      }}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    />
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
    flexGrow: 1,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  sectionHeaderBlock: {
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionAddButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.brand50,
  },
  sectionAddText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand700,
  },
  sectionDescription: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: -4,
    marginBottom: 10,
  },
  placeholder: {
    fontSize: 13,
    color: colors.slate500,
    paddingVertical: 12,
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: colors.brand600,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
