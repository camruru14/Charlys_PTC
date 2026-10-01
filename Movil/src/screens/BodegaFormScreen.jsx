import { useWarehouses } from "../hooks/useWarehouses";
import SingleFieldForm from "../components/settings/SingleFieldForm";

// Agregar una bodega (EntityModal de Configuracion.jsx en la web). El nombre
// se cambia y la bodega se elimina desde Configuración > Bodegas.
export default function BodegaFormScreen({ navigation }) {
  const { crear } = useWarehouses();
  return (
    <SingleFieldForm
      navigation={navigation}
      title="Nueva bodega"
      label="Nombre de la bodega"
      placeholder="Ej. Bodega Central"
      emptyMessage="Escribe el nombre de la bodega"
      onSubmit={(name) => crear({ name })}
      successMessage={(name) => `${name} agregada`}
    />
  );
}
