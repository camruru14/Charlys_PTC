import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import BottomSheet from "../ui/BottomSheet";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import Icon from "../ui/Icon";
import SelectField from "../ui/SelectField";
import { colors } from "../../lib/theme";
import { fonts, type } from "../../lib/typography";
import { formatNumber } from "../../lib/format";
import { pendingUnits, productLabel } from "../../lib/batchFlow";
import { withCurrentLine } from "../../hooks/useProductionLines";

// Hojas de las acciones de un lote (los «cuadros en línea» de BatchDetail.jsx
// en la web). Cada una recibe `batch` (null = cerrada) y sigue mostrando el
// último lote mientras se cierra, para que el contenido no desaparezca
// durante la animación.
function useLast(value) {
  const ref = useRef(value);
  if (value) ref.current = value;
  return value || ref.current;
}

// Mientras no se ha abierto nunca (sin lote actual ni anterior), la hoja se
// monta cerrada y vacía: su contenido depende del lote y no se arma sin él.
function ClosedSheet({ onClose }) {
  return <BottomSheet visible={false} onClose={onClose} />;
}

function Actions({ onCancel, confirmTitle, onConfirm, disabled, busy }) {
  return (
    <View style={styles.actions}>
      <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.action} />
      <Button title={confirmTitle} onPress={onConfirm} disabled={disabled} loading={busy} style={styles.action} />
    </View>
  );
}

// Iniciar cuando al lote le falta línea u operario.
export function StartBatchSheet({ batch: current, lines, operators, busy, onClose, onConfirm }) {
  const batch = useLast(current);
  const [line, setLine] = useState("");
  const [operator, setOperator] = useState("");
  useEffect(() => {
    if (!current) return;
    setLine(current.productionLine || "");
    setOperator(current.operator?._id || current.operator || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id]);
  const needsOperator = operators.length > 0;

  if (!batch) return <ClosedSheet onClose={onClose} />;

  return (
    <BottomSheet
      visible={Boolean(current)}
      onClose={onClose}
      title={batch ? `Iniciar ${batch.batchNumber}` : ""}
      subtitle={`Elige la línea${needsOperator ? " y el operario" : ""} para iniciar`}
      footer={
        <Actions
          onCancel={onClose}
          confirmTitle="Iniciar"
          busy={busy}
          disabled={!line || (needsOperator && !operator)}
          onConfirm={() => onConfirm({ productionLine: line, operator: operator || undefined })}
        />
      }
    >
      <SelectField
        label="Línea"
        value={line}
        options={withCurrentLine(lines, batch?.productionLine).map((l) => ({ label: l, value: l }))}
        onChange={setLine}
        placeholder="Selecciona…"
      />
      <SelectField
        label="Operario"
        value={operator}
        options={operators.map((o) => ({ label: `${o.name} ${o.lastName}`, value: o._id }))}
        onChange={setOperator}
        placeholder={needsOperator ? "Selecciona…" : "Sin operarios en Fabricación"}
      />
    </BottomSheet>
  );
}

// Detener con un motivo opcional.
export function StopBatchSheet({ batch: current, busy, onClose, onConfirm }) {
  const batch = useLast(current);
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (current) setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id]);

  if (!batch) return <ClosedSheet onClose={onClose} />;

  return (
    <BottomSheet
      visible={Boolean(current)}
      onClose={onClose}
      title={batch ? `Detener ${batch.batchNumber}` : ""}
      footer={<Actions onCancel={onClose} confirmTitle="Detener" busy={busy} onConfirm={() => onConfirm(reason)} />}
    >
      <FormField label="Motivo (opcional)" value={reason} onChangeText={setReason} placeholder="Ej. Cambio de molde" />
    </BottomSheet>
  );
}

// Completar: unidades producidas con un contador grande (− / +) que también
// se puede escribir. Arranca en la meta, como la web.
export function CompleteBatchSheet({ batch: current, busy, onClose, onConfirm }) {
  const batch = useLast(current);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (current) setValue(current.targetQuantity != null ? String(current.targetQuantity) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id]);

  const produced = Number(value) || 0;
  const target = batch?.targetQuantity;
  const pct = target ? Math.round((produced / target) * 100) : null;
  const step = (delta) => setValue(String(Math.max(0, produced + delta)));

  if (!batch) return <ClosedSheet onClose={onClose} />;

  return (
    <BottomSheet
      visible={Boolean(current)}
      onClose={onClose}
      title={batch ? `Completar ${batch.batchNumber}` : ""}
      subtitle={batch ? [productLabel(batch), batch.productionLine].filter(Boolean).join(" · ") : ""}
      footer={
        <Actions
          onCancel={onClose}
          confirmTitle="Confirmar"
          busy={busy}
          disabled={value === ""}
          onConfirm={() => onConfirm(produced)}
        />
      }
    >
      <Text style={[type.overline, styles.label]}>Unidades producidas</Text>
      <View style={styles.counter}>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel="Restar una unidad"
          style={({ pressed }) => [styles.counterButton, pressed && styles.pressed]}
        >
          <Icon name="minus" size={20} color={colors.ink} />
        </Pressable>
        <TextInput
          style={styles.counterInput}
          value={value === "" ? "" : formatNumber(produced)}
          onChangeText={(v) => setValue(v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          selectTextOnFocus
          accessibilityLabel="Unidades producidas"
        />
        <Pressable
          onPress={() => step(1)}
          accessibilityRole="button"
          accessibilityLabel="Sumar una unidad"
          style={({ pressed }) => [styles.counterButton, pressed && styles.pressed]}
        >
          <Icon name="plus" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.note}>
        Meta {target != null ? `${formatNumber(target)} u` : "—"}
        {pct != null ? ` · ${pct}% de la meta` : ""}
      </Text>
    </BottomSheet>
  );
}

// Existencia actual del artículo del lote (mismo producto y color) por
// bodega. Solo producto terminado real (sin reportes de lote).
function stockByWarehouse(batch, finishedItems) {
  const map = new Map();
  if (!batch) return map;
  for (const i of finishedItems || []) {
    if (i.batchNumber || i.name !== batch.product || (i.color || "") !== (batch.color || "")) continue;
    map.set(i.location, (map.get(i.location) || 0) + (Number(i.stock) || 0));
  }
  return map;
}

// Bodega preseleccionada: la que ya tiene el artículo (la de más stock).
function suggestedWarehouse(warehouses = [], stock) {
  let best = null;
  for (const w of warehouses) {
    if (!stock.has(w)) continue;
    if (best == null || stock.get(w) > stock.get(best)) best = w;
  }
  return best ?? warehouses[0] ?? "";
}

// Enviar a bodega un lote completado (SendToWarehouseModal de la web).
export function SendToWarehouseSheet({ batch: current, warehouses, finishedItems, busy, onClose, onConfirm }) {
  const batch = useLast(current);
  const stock = stockByWarehouse(batch, finishedItems);
  const [warehouse, setWarehouse] = useState("");
  useEffect(() => {
    if (current) setWarehouse(suggestedWarehouse(warehouses, stockByWarehouse(current, finishedItems)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?._id]);
  const units = pendingUnits(batch);

  // Sin lote no se arma la lista de bodegas ni las notas (dependen de él).
  if (!batch) return <ClosedSheet onClose={onClose} />;

  return (
    <BottomSheet
      visible={Boolean(current)}
      onClose={onClose}
      title="Enviar a bodega"
      subtitle={batch ? `${batch.batchNumber} · ${formatNumber(units)} unidades` : ""}
      footer={
        <Actions
          onCancel={onClose}
          confirmTitle={`Enviar ${formatNumber(units)} u`}
          busy={busy}
          disabled={!warehouse}
          onConfirm={() => onConfirm(warehouse)}
        />
      }
    >
      <Text style={[type.overline, styles.label]}>Bodega de destino</Text>
      {warehouses.length === 0 ? (
        <Text style={styles.note}>No hay bodegas configuradas. Agrégalas en Configuración → Bodegas.</Text>
      ) : (
        warehouses.map((w) => {
          const active = w === warehouse;
          const has = stock.has(w);
          return (
            <Pressable
              key={w}
              onPress={() => setWarehouse(w)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.optionTexts}>
                <Text style={styles.optionTitle}>{w}</Text>
                <Text style={styles.optionDetail}>
                  {has
                    ? `Ya tiene ${formatNumber(stock.get(w))} de ${productLabel(batch)} · quedarían ${formatNumber(stock.get(w) + units)}`
                    : `Sin ${productLabel(batch)} · entraría como nuevo`}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
      <Text style={styles.note}>
        Las {formatNumber(units)} unidades aparecen de una vez en Inventario → Producto terminado, en la bodega elegida. El
        lote queda marcado «En bodega».
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  label: { marginBottom: 10 },
  counter: { flexDirection: "row", alignItems: "center", gap: 10 },
  counterButton: {
    width: 50,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.surface2 },
  counterInput: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.selectBar,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontFamily: fonts.extrabold,
    fontSize: 26,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    paddingVertical: 0,
  },
  note: { marginTop: 10, marginBottom: 4, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionActive: { borderWidth: 2, padding: 13, borderColor: colors.selectBar, backgroundColor: colors.selectBg },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.busyLine,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionTexts: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  optionDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
