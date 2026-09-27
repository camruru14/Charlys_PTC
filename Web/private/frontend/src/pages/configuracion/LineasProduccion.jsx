import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import StatusPill from "../../components/ui/StatusPill";
import { Field } from "../../components/ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { IconEdit, IconFactory, IconPlus, IconTrash } from "../../lib/icons";
import { fmtNumber } from "../../lib/format";
import { ListCard, ListRow, RowAction, RowIcon, RowText } from "./SettingsList";

const inProcessText = (n) => `${fmtNumber(n)} ${n === 1 ? "lote en proceso" : "lotes en proceso"}`;

/*
  Modal para agregar o editar una línea (nombre y, al editar, si está
  activa). Renombrar también actualiza los lotes que la usan (backend).
*/
function LineModal({ line, activeCount, onClose, onSaved }) {
  const [name, setName] = useState(line?.name || "");
  const [active, setActive] = useState(line ? line.active : true);
  const [busy, setBusy] = useState(false);
  const lastActive = Boolean(line?.active) && activeCount <= 1;

  async function submit(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return toast.error("Escribe el nombre de la línea");
    const changes = {};
    if (!line || value !== line.name) changes.name = value;
    if (line && active !== line.active) changes.active = active;
    if (line && !Object.keys(changes).length) return onClose();
    setBusy(true);
    try {
      if (line) await api.patch(`/productionLines/${line._id}`, changes);
      else await api.post("/productionLines", { name: value });
      toast.success(line ? `${value} actualizada` : `${value} agregada`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={line ? "Editar línea de producción" : "Nueva línea de producción"}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="line-form" disabled={busy} className={buttonClass("primary", "modal")}>
            {busy ? "Guardando…" : line ? "Guardar" : "Agregar"}
          </button>
        </>
      }
    >
      <form id="line-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nombre de la línea" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Línea 5" autoFocus required />
        {line && name.trim() && name.trim() !== line.name ? (
          <p className="t-aux">Los lotes que usan «{line.name}» pasarán a «{name.trim()}».</p>
        ) : null}
        {line ? (
          <label className={`flex items-center gap-2 text-[13px] font-medium text-ink-2 ${lastActive ? "opacity-60" : ""}`} title={lastActive ? "Debe quedar al menos una línea activa" : undefined}>
            <input
              type="checkbox"
              checked={active}
              disabled={lastActive}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-primary"
            />
            Línea activa (aparece al crear o iniciar lotes)
          </label>
        ) : null}
      </form>
    </Modal>
  );
}

/*
  Configuración > Líneas de producción. Las activas son las opciones al crear
  o iniciar un lote en Fabricación (hooks/useProductionLines.js). Una línea
  con lotes en proceso no se puede eliminar (el backend también lo impide), y
  siempre debe quedar al menos una activa.
    lines: [{ _id, name, active, inProcess }]
*/
function LineasProduccion({ lines, loading, error, refetch }) {
  const { confirm, confirmProps } = useConfirm();
  // null = cerrado; { line: null } = nueva; { line } = editar.
  const [editing, setEditing] = useState(null);
  const activeCount = lines.filter((l) => l.active).length;

  // Motivo por el que no se puede eliminar (se muestra al pasar sobre el ícono).
  function deleteBlock(line) {
    if (line.inProcess > 0) return `No se puede eliminar: tiene ${inProcessText(line.inProcess)}`;
    if (line.active && activeCount <= 1) return "No se puede eliminar: es la única línea activa";
    return null;
  }

  async function remove(line) {
    if (!(await confirm(`¿Eliminar «${line.name}»? Ya no se podrá elegir al crear o iniciar lotes. Los lotes que ya la usan conservan el nombre.`, { danger: true }))) return;
    try {
      await api.del(`/productionLines/${line._id}`);
      toast.success(`${line.name} eliminada`);
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      refetch();
    }
  }

  return (
    <>
      <ListCard
        title="Líneas de producción"
        subtitle="Las activas aparecen al crear o iniciar un lote en Fabricación"
        action={
          <Button variant="soft" size="detail" icon={IconPlus} onClick={() => setEditing({ line: null })}>
            Agregar
          </Button>
        }
        items={lines}
        loading={loading}
        error={error}
        emptyText="No hay líneas registradas."
        noun="líneas"
        renderRow={(line) => {
          const blocked = deleteBlock(line);
          return (
            <ListRow key={line._id}>
              <RowIcon icon={IconFactory} />
              <RowText title={line.name} detail={line.inProcess > 0 ? inProcessText(line.inProcess) : "Sin lotes en proceso"} muted={!line.active} />
              <StatusPill status={line.active ? "Activa" : "Inactiva"} domain="linea" />
              <RowAction icon={IconEdit} label={`Editar ${line.name}`} onClick={() => setEditing({ line })} />
              <RowAction icon={IconTrash} label={`Eliminar ${line.name}`} danger disabled={Boolean(blocked)} reason={blocked} onClick={() => remove(line)} />
            </ListRow>
          );
        }}
      />
      {editing ? (
        <LineModal key={editing.line?._id || "new"} line={editing.line} activeCount={activeCount} onClose={() => setEditing(null)} onSaved={refetch} />
      ) : null}
      <ConfirmModal {...confirmProps} />
    </>
  );
}

export default LineasProduccion;
