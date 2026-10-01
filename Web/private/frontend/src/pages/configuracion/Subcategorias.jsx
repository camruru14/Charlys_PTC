import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import StatusPill from "../../components/ui/StatusPill";
import Tabs from "../../components/ui/Tabs";
import { Field, SelectField } from "../../components/ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { IconEdit, IconPlus, IconTag, IconTrash } from "../../lib/icons";
import { fmtNumber } from "../../lib/format";
import { ListCard, ListRow, RowAction, RowIcon, RowText } from "./SettingsList";

const CATEGORIES = ["Pajillas", "Pelotas"];
const ALL = "todas";
const IN_USE_REASON = "No se puede eliminar: ya se usa en registros (solo puedes desactivarla)";

/*
  Modal para agregar o editar una subcategoría (nombre, categoría y, al
  editar, si está activa). Si ya se usa en registros, el nombre y la categoría
  quedan bloqueados (el backend también lo impide): solo se puede activar o
  desactivar.
*/
function SubcategoryModal({ subcategory, defaultCategory, onClose, onSaved }) {
  const [name, setName] = useState(subcategory?.name || "");
  const [category, setCategory] = useState(subcategory?.category || defaultCategory);
  const [active, setActive] = useState(subcategory ? subcategory.active : true);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(subcategory?.inUse);

  async function submit(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return toast.error("Escribe el nombre de la subcategoría");
    const changes = {};
    if (!subcategory || value !== subcategory.name) changes.name = value;
    if (!subcategory || category !== subcategory.category) changes.category = category;
    if (subcategory && active !== subcategory.active) changes.active = active;
    if (subcategory && !Object.keys(changes).length) return onClose();
    setBusy(true);
    try {
      if (subcategory) await api.patch(`/subcategories/${subcategory._id}`, changes);
      else await api.post("/subcategories", changes);
      toast.success(subcategory ? `${value} actualizada` : `${value} agregada`);
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
      title={subcategory ? "Editar subcategoría" : "Nueva subcategoría"}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="subcategory-form" disabled={busy} className={buttonClass("primary", "modal")}>
            {busy ? "Guardando…" : subcategory ? "Guardar" : "Agregar"}
          </button>
        </>
      }
    >
      <form id="subcategory-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Nombre"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Pajilla jumbo"
          disabled={locked}
          autoFocus={!locked}
          required
        />
        {locked ? (
          <div className="pointer-events-none opacity-60" aria-disabled="true">
            <SelectField label="Categoría" name="category" value={category} onChange={() => {}} options={CATEGORIES} required />
          </div>
        ) : (
          <SelectField label="Categoría" name="category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATEGORIES} required />
        )}
        {locked ? <p className="t-aux">El nombre y la categoría no se pueden cambiar: la subcategoría ya se usa en registros.</p> : null}
        {subcategory ? (
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-line accent-primary" />
            Subcategoría activa (se puede elegir al crear o editar productos)
          </label>
        ) : null}
      </form>
    </Modal>
  );
}

/*
  Configuración > Subcategorías. Cada una pertenece a una categoría del
  catálogo (Pajillas o Pelotas); las activas son las opciones al crear o
  editar un producto en Catálogo. El nombre es el «producto» que se muestra en
  el sistema, por eso una subcategoría que ya se usa no se puede renombrar,
  cambiar de categoría ni eliminar (solo desactivar).
    subcategories: [{ _id, name, category, active, inUse }]
*/
function Subcategorias({ subcategories, loading, error, refetch }) {
  const { confirm, confirmProps } = useConfirm();
  const [filter, setFilter] = useState(ALL);
  // null = cerrado; { subcategory: null } = nueva; { subcategory } = editar.
  const [editing, setEditing] = useState(null);

  const tabs = [
    { key: ALL, label: `Todas · ${fmtNumber(subcategories.length)}` },
    ...CATEGORIES.map((c) => ({ key: c, label: `${c} · ${fmtNumber(subcategories.filter((s) => s.category === c).length)}` })),
  ];
  const items = filter === ALL ? subcategories : subcategories.filter((s) => s.category === filter);

  async function remove(sub) {
    if (!(await confirm(`¿Eliminar «${sub.name}»? Ya no se podrá elegir al crear o editar productos.`, { danger: true }))) return;
    try {
      await api.del(`/subcategories/${sub._id}`);
      toast.success(`${sub.name} eliminada`);
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      refetch();
    }
  }

  return (
    <>
      <ListCard
        title="Subcategorías"
        subtitle="Su nombre es el producto que se muestra en el sistema; las activas se eligen en Catálogo"
        action={
          <Button variant="soft" size="detail" icon={IconPlus} onClick={() => setEditing({ subcategory: null })}>
            Agregar
          </Button>
        }
        toolbar={<Tabs tabs={tabs} value={filter} onChange={setFilter} />}
        items={items}
        resetKey={filter}
        loading={loading}
        error={error}
        emptyText={subcategories.length ? "No hay subcategorías en esta categoría." : "No hay subcategorías registradas."}
        noun="subcategorías"
        renderRow={(sub) => (
          <ListRow key={sub._id}>
            <RowIcon icon={IconTag} />
            <RowText title={sub.name} detail={`${sub.category} · ${sub.inUse ? "En uso en registros" : "Sin registros"}`} muted={!sub.active} />
            <StatusPill status={sub.active ? "Activa" : "Inactiva"} domain="linea" />
            <RowAction icon={IconEdit} label={`Editar ${sub.name}`} onClick={() => setEditing({ subcategory: sub })} />
            <RowAction
              icon={IconTrash}
              label={`Eliminar ${sub.name}`}
              danger
              disabled={sub.inUse}
              reason={sub.inUse ? IN_USE_REASON : undefined}
              onClick={() => remove(sub)}
            />
          </ListRow>
        )}
      />
      {editing ? (
        <SubcategoryModal
          key={editing.subcategory?._id || "new"}
          subcategory={editing.subcategory}
          defaultCategory={filter === ALL ? CATEGORIES[0] : filter}
          onClose={() => setEditing(null)}
          onSaved={refetch}
        />
      ) : null}
      <ConfirmModal {...confirmProps} />
    </>
  );
}

export default Subcategorias;
