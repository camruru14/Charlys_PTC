import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Button from "../../components/ui/Button";
import ActionsMenu from "../../components/ui/ActionsMenu";
import ConfirmModal from "../../components/ui/ConfirmModal";
import EmptyState from "../../components/ui/EmptyState";
import StatusPill from "../../components/ui/StatusPill";
import { IconFactory, IconPlus } from "../../lib/icons";
import { fmtNumber } from "../../lib/format";

const inputClass =
  "h-[34px] w-full max-w-[320px] rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

/*
  Configuración > Líneas de producción. Las activas son las opciones al crear
  o iniciar un lote en Fabricación (hooks/useProductionLines.js). Una línea
  con lotes en proceso no se puede eliminar (el backend también lo impide), y
  siempre debe quedar al menos una activa.
    lines: [{ _id, name, active, inProcess }]
*/
function LineasProduccion({ lines, loading, error, refetch }) {
  const { confirm, confirmProps } = useConfirm();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const activeCount = lines.filter((l) => l.active).length;

  async function run(fn, message) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      return false;
    } finally {
      setBusy(false);
      refetch();
    }
  }

  async function add(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (await run(() => api.post("/productionLines", { name: value }), `${value} agregada`)) setName("");
  }

  function toggle(line) {
    run(() => api.patch(`/productionLines/${line._id}`, { active: !line.active }), `${line.name} ${line.active ? "desactivada" : "activada"}`);
  }

  async function remove(line) {
    if (!(await confirm(`¿Eliminar «${line.name}»? Ya no se podrá elegir al crear o iniciar lotes. Los lotes que ya la usan conservan el nombre.`, { danger: true }))) return;
    run(() => api.del(`/productionLines/${line._id}`), `${line.name} eliminada`);
  }

  // Motivo por el que no se puede eliminar o desactivar (se muestra en la fila y en el menú).
  function deleteBlock(line) {
    if (line.inProcess > 0) return `Tiene ${fmtNumber(line.inProcess)} ${line.inProcess === 1 ? "lote en proceso" : "lotes en proceso"}: no se puede eliminar`;
    if (line.active && activeCount <= 1) return "Es la única línea activa: no se puede eliminar";
    return null;
  }

  let body;
  if (loading && !lines.length) body = <EmptyState title="Cargando líneas…" />;
  else if (error) body = <EmptyState title="No se pudieron cargar las líneas" description={error} />;
  else if (!lines.length) body = <EmptyState title="No hay líneas registradas." />;
  else
    body = lines.map((line) => {
      const blocked = deleteBlock(line);
      const detail = line.inProcess > 0 ? `${fmtNumber(line.inProcess)} ${line.inProcess === 1 ? "lote en proceso" : "lotes en proceso"}` : "Sin lotes en proceso";
      return (
        <div key={line._id} className="flex min-h-[58px] items-center gap-3 border-b border-line-soft px-5 py-2.5 last:border-b-0">
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-line-soft bg-surface-2 text-muted">
            <IconFactory width={16} height={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[13.5px] font-semibold ${line.active ? "text-ink" : "text-muted"}`}>{line.name}</span>
            <span className="t-aux block truncate">{blocked && line.inProcess > 0 ? `${detail} · no se puede eliminar` : detail}</span>
          </span>
          <StatusPill status={line.active ? "Activa" : "Inactiva"} domain="linea" />
          <ActionsMenu
            size="row"
            items={[
              {
                label: line.active ? "Desactivar" : "Activar",
                disabled: busy || (line.active && activeCount <= 1),
                hint: line.active && activeCount <= 1 ? "Debe quedar al menos una línea activa" : "Las inactivas no aparecen al crear o iniciar lotes",
                onClick: () => toggle(line),
              },
              { label: "Eliminar", danger: true, disabled: busy || Boolean(blocked), hint: blocked, onClick: () => remove(line) },
            ]}
          />
        </div>
      );
    });

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="px-5 pb-3.5 pt-4">
        <h2 className="t-card-title">Líneas de producción</h2>
        <p className="t-aux mt-0.5">Las activas aparecen al crear o iniciar un lote en Fabricación</p>
      </div>
      <form onSubmit={add} className="flex items-center gap-3 border-t border-line-soft px-5 py-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la nueva línea (ej. Línea 5)" className={inputClass} />
        <Button type="submit" variant="soft" size="detail" icon={IconPlus} disabled={busy || !name.trim()}>
          Agregar
        </Button>
      </form>
      <div className="border-t border-line-soft">{body}</div>
      <ConfirmModal {...confirmProps} />
    </section>
  );
}

export default LineasProduccion;
