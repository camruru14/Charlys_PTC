import { View } from "react-native";
import Segmented from "./Segmented";
import { FieldLabel, fieldStyles } from "./fieldStyles";

// Segmented como campo de formulario, con etiqueta arriba. Usado en vez de un
// Picker nativo para status/tipo/categoría/departamento/operario. `options`
// puede ser un arreglo de strings o de objetos (con getLabel/getValue).
export default function SegmentedField({
  label,
  value,
  options,
  onChange,
  getLabel,
  getValue,
  required = false,
  scrollable,
  style,
}) {
  return (
    <View style={[fieldStyles.field, style]}>
      <FieldLabel label={label} required={required} />
      <Segmented
        options={options}
        value={value}
        onChange={onChange}
        getLabel={getLabel}
        getValue={getValue}
        scrollable={scrollable}
      />
    </View>
  );
}
