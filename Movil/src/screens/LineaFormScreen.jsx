import { useProductionLines } from "../hooks/useProductionLines";
import SingleFieldForm from "../components/settings/SingleFieldForm";

// Agregar una línea de producción (LineModal de LineasProduccion.jsx en la
// web). Una línea nueva queda activa; el nombre, el estado y eliminarla se
// manejan desde Configuración > Líneas de producción.
export default function LineaFormScreen({ navigation }) {
  const { crear } = useProductionLines();
  return (
    <SingleFieldForm
      navigation={navigation}
      title="Nueva línea de producción"
      label="Nombre de la línea"
      placeholder="Ej. Línea 5"
      emptyMessage="Escribe el nombre de la línea"
      note="Aparece al crear o iniciar lotes en Fabricación."
      onSubmit={(name) => crear({ name })}
      successMessage={(name) => `${name} agregada`}
    />
  );
}
