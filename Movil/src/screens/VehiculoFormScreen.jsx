import { useVehicles } from "../hooks/useVehicles";
import SingleFieldForm from "../components/settings/SingleFieldForm";

// Agregar un vehículo (EntityModal de Configuracion.jsx en la web: solo la
// placa). La placa se cambia y el vehículo se elimina desde Configuración >
// Vehículos.
export default function VehiculoFormScreen({ navigation }) {
  const { crear } = useVehicles();
  return (
    <SingleFieldForm
      navigation={navigation}
      title="Nuevo vehículo"
      label="Placa"
      placeholder="Ej. P123-456"
      emptyMessage="Escribe la placa del vehículo"
      autoCapitalize="characters"
      onSubmit={(plate) => crear({ plate })}
      successMessage={(plate) => `Vehículo ${plate} agregado`}
    />
  );
}
