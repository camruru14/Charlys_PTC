import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "../ui/BottomSheet";
import Icon from "../ui/Icon";
import { colors, tones } from "../../lib/theme";
import { fonts } from "../../lib/typography";
import { formatMoney } from "../../lib/format";
import { catalogStatus } from "../../lib/catalogOptions";

function ActionRow({ icon, label, note, danger, onPress, first }) {
  const color = danger ? tones.rose.text : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      <Icon name={icon} size={19} color={danger ? tones.rose.text : colors.muted} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

// Acciones de un producto del Catálogo (la card de la web tiene Editar,
// subir imagen y Eliminar; destacado y visible son los mismos campos del
// formulario, guardados con el mismo PUT /products/:id).
//   onAction("edit" | "upload" | "featured" | "active" | "delete", product)
export default function ProductActionsSheet({ product, onClose, onAction }) {
  // Se conserva el último producto para que la hoja se vea mientras se cierra.
  const last = useRef(product);
  if (product) last.current = product;
  const p = last.current;

  const run = (action) => {
    const target = p;
    onClose();
    // Las acciones que abren un Alert o el selector de fotos esperan a que la
    // hoja termine de cerrarse (en iOS no se muestran sobre un Modal que se va).
    if (action === "edit") onAction(action, target);
    else setTimeout(() => onAction(action, target), 260);
  };

  return (
    <BottomSheet
      visible={Boolean(product)}
      onClose={onClose}
      title={p?.name}
      subtitle={p ? [p.category, formatMoney(p.price), catalogStatus(p)].filter(Boolean).join(" · ") : undefined}
    >
      {p ? (
        <View style={styles.list}>
          <ActionRow first icon="tag" label="Editar producto" onPress={() => run("edit")} />
          <ActionRow icon="plus" label="Subir foto" note="Cámara o galería" onPress={() => run("upload")} />
          <ActionRow
            icon="check"
            label={p.featured ? "Quitar de destacados" : "Marcar como destacado"}
            note="Sale en Inicio"
            onPress={() => run("featured")}
          />
          <ActionRow
            icon={p.active === false ? "eye" : "eyeOff"}
            label={p.active === false ? "Mostrar en la tienda" : "Ocultar de la tienda"}
            onPress={() => run("active")}
          />
          <ActionRow danger icon="trash" label="Eliminar producto" note="Borra sus fotos" onPress={() => run("delete")} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { marginBottom: 4 },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  pressed: { backgroundColor: colors.surface2 },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 15 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
