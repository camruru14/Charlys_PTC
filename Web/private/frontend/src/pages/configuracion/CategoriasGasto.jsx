import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import BudgetBar from "../../components/finance/BudgetBar";
import ActionsMenu from "../../components/ui/ActionsMenu";
import Button from "../../components/ui/Button";
import ConfirmModal from "../../components/ui/ConfirmModal";
import EmptyState from "../../components/ui/EmptyState";
import { IconAlert, IconCheck, IconLock, IconOrders, IconPlus } from "../../lib/icons";
import { budgetChanges, categoryIcon, categoryTone, COLOR_KEYS, ICON_KEYS, monthKey, parseBudget } from "../../lib/expenseCategories";
import { daysInMonth, money, plural } from "../../lib/finance";
import { fmtMonth } from "../../lib/format";

/*
  Configuración › Categorías de gasto: las categorías que aparecen al registrar
  un gasto en Finanzas, con un presupuesto mensual opcional. El presupuesto se
  edita en la tabla y se guarda junto con «Guardar cambios» (un solo PUT
  /expense-categories/budgets del mes en curso, vigente desde ese mes). El
  borrador (`draft`: { [id]: texto }) vive en Configuración para que sobreviva
  al cambiar de sección. Nunca se borran categorías: se archivan.
*/

const COLUMNS = "34px minmax(0,1.1fr) 150px minmax(0,1.5fr) 36px";
const PICKER_HEIGHT = 210;
const ROW = "grid h-[64px] items-center gap-3 border-b border-line-soft px-5";
const inputClass =
  "h-9 rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

// Campo de dinero: solo dígitos y un punto (nunca negativo).
const cleanMoney = (text) => text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

function MoneyInput({ value, onChange, label, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="Sin presupuesto"
        aria-label={label}
        onChange={(e) => onChange(cleanMoney(e.target.value))}
        className={`${inputClass} w-full pl-6 text-right tabular-nums`}
      />
    </div>
  );
}

// Selector de ícono (9) y color (7). Cada toque se guarda en el momento.
function IconColorPicker({ anchorId, icon, color, onChange, onClose }) {
  const ref = useRef(null);
  // Debajo del ícono; si abajo no cabe (última fila), por encima.
  const [pos] = useState(() => {
    const rect = document.getElementById(anchorId)?.getBoundingClientRect();
    if (!rect) return { top: 120, left: 240 };
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 284));
    return window.innerHeight - rect.bottom >= PICKER_HEIGHT + 12 ? { top: rect.bottom + 6, left } : { bottom: window.innerHeight - rect.top + 6, left };
  });
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    const onScroll = (e) => !ref.current?.contains(e.target) && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Ícono y color" style={{ position: "fixed", ...pos }} className="z-40 w-[276px] rounded-[12px] border border-line bg-surface p-3.5 shadow-modal">
      <IconColorFields icon={icon} color={color} onChange={onChange} />
    </div>
  );
}

// Las dos filas de opciones (íconos y colores), compartidas por el popover y «Nueva categoría».
function IconColorFields({ icon, color, onChange }) {
  const tone = categoryTone(color);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="t-label mb-1.5">Ícono</p>
        <div className="flex flex-wrap gap-1.5">
          {ICON_KEYS.map((key) => {
            const Icon = categoryIcon(key);
            const selected = key === icon;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                aria-label={`Ícono ${key}`}
                onClick={() => onChange({ icon: key })}
                className={`flex h-8 w-8 items-center justify-center rounded-[9px] border transition ${
                  selected ? `${tone.soft} ${tone.border}` : "border-line text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon width={15} height={15} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="t-label mb-1.5">Color</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEYS.map((key) => {
            const selected = key === color;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                aria-label={`Color ${key}`}
                onClick={() => onChange({ color: key })}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${categoryTone(key).dot} ${selected ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-surface" : "hover:opacity-80"}`}
              >
                {selected ? <IconCheck width={12} height={12} className="text-white" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Nombre editable en la fila (Renombrar): Enter o salir del campo guarda, Escape cancela.
function RenameInput({ value, onSave, onCancel }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  async function save() {
    const next = draft.trim();
    if (busy) return;
    if (!next || next === value) return onCancel();
    setBusy(true);
    try {
      await onSave(next);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  }
  return (
    <span className="min-w-0 flex-1">
      <input
        autoFocus
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") onCancel();
        }}
        aria-label="Nuevo nombre de la categoría"
        className="h-[28px] w-full max-w-[260px] rounded-[7px] border border-select-bar bg-surface px-2 text-[13.5px] font-semibold text-ink outline-none ring-2 ring-primary-soft"
      />
      <span className="t-aux block">Enter para guardar · Esc para cancelar</span>
    </span>
  );
}

function Stat({ label, value, sub, subClass = "text-muted" }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-line-soft bg-surface-2 px-4 py-3">
      <p className="t-label">{label}</p>
      <p className="mt-0.5 truncate text-[19px] font-bold tabular-nums text-ink">{value}</p>
      <p className={`truncate text-[11.5px] tabular-nums ${subClass}`}>{sub}</p>
    </div>
  );
}

function CategoriasGasto({ categories, loading, error, refetch, mutate, draft, setDraft }) {
  const { confirm, confirmProps } = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [picker, setPicker] = useState(null);
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState({ name: "", budget: "", icon: "tag", color: "gray" });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const month = monthKey(now);
  const monthName = fmtMonth(now);
  const dayPct = (now.getDate() / daysInMonth(now)) * 100;

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const changes = budgetChanges(categories, draft);

  // Presupuesto que se ve en el campo: el borrador si lo hay, si no el guardado.
  const fieldValue = (c) => (draft[c._id] !== undefined ? draft[c._id] : c.usage?.budget == null ? "" : String(c.usage.budget));
  const effectiveBudget = (c) => {
    const parsed = parseBudget(fieldValue(c));
    return Number.isNaN(parsed) ? (c.usage?.budget ?? null) : parsed;
  };
  const setField = (c, text) =>
    setDraft((d) => {
      const next = { ...d };
      const saved = c.usage?.budget == null ? "" : String(c.usage.budget);
      if (text === saved) delete next[c._id];
      else next[c._id] = text;
      return next;
    });

  const sum = (list, pick) => list.reduce((s, c) => s + (Number(pick(c)) || 0), 0);
  const budgetSaved = sum(active, (c) => c.usage?.budget);
  const budgetNow = sum(active, (c) => effectiveBudget(c));
  const delta = budgetNow - budgetSaved;
  const paid = sum(categories, (c) => c.usage?.paid);
  const pending = sum(categories, (c) => c.usage?.pending);
  const usedPct = budgetNow > 0 ? Math.round((paid / budgetNow) * 100) : null;

  async function update(c, body, okMessage) {
    await api.put(`/expense-categories/${c._id}`, body);
    if (okMessage) toast.success(okMessage);
    refetch();
  }

  async function archive(c) {
    const message = `«${c.name}» ya no aparecerá al registrar un gasto. Sus movimientos se conservan y puedes restaurarla desde «Archivadas».`;
    if (!(await confirm(message, { danger: true, title: "Archivar categoría", confirmLabel: "Archivar" }))) return;
    try {
      await update(c, { archived: true }, `«${c.name}» archivada`);
      setDraft((d) => {
        const next = { ...d };
        delete next[c._id];
        return next;
      });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function restore(c) {
    try {
      await update(c, { archived: false }, `«${c.name}» restaurada`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function changeStyle(c, patch) {
    try {
      await update(c, patch);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    const name = fresh.name.trim();
    if (!name) return toast.error("Escribe el nombre de la categoría");
    const budget = parseBudget(fresh.budget);
    if (Number.isNaN(budget)) return toast.error("El presupuesto debe ser un número mayor o igual a 0");
    setSaving(true);
    try {
      await api.post("/expense-categories", { name, icon: fresh.icon, color: fresh.color, ...(budget != null ? { budget } : {}) });
      toast.success(`Categoría «${name}» creada`);
      setFresh({ name: "", budget: "", icon: "tag", color: "gray" });
      setAdding(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBudgets() {
    if (budgetChanges(categories, draft).some((c) => Number.isNaN(c.to))) return toast.error("Revisa los presupuestos: deben ser números mayores o iguales a 0");
    setSaving(true);
    try {
      const saved = await api.put("/expense-categories/budgets", { month, items: changes.map((c) => ({ id: c.category._id, amount: c.to })) });
      mutate(saved);
      setDraft({});
      toast.success("Presupuestos guardados");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const pickerCategory = picker ? categories.find((c) => c._id === picker) : null;
  const list = showArchived ? archived : active;

  function renderRow(c) {
    const Icon = categoryIcon(c.icon);
    const tone = categoryTone(c.color);
    const usage = c.usage || { paid: 0, pending: 0, count: 0 };
    const budget = effectiveBudget(c);
    const dirty = draft[c._id] !== undefined && changes.some((x) => x.category._id === c._id);
    const items = [
      { label: "Renombrar", onClick: () => setRenaming(c._id) },
      { label: "Cambiar ícono y color", onClick: () => setPicker(c._id) },
      { label: "Archivar", onClick: () => archive(c), danger: true },
    ];
    return (
      <div key={c._id} style={{ gridTemplateColumns: COLUMNS }} className={`${ROW} ${dirty ? "bg-primary-soft/40" : ""}`}>
        <button
          id={`category-icon-${c._id}`}
          type="button"
          onClick={() => setPicker(c._id)}
          aria-label={`Cambiar el ícono y el color de ${c.name}`}
          title="Cambiar ícono y color"
          className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] transition hover:opacity-80 ${tone.soft}`}
        >
          <Icon width={16} height={16} />
        </button>

        {renaming === c._id ? (
          <RenameInput
            value={c.name}
            onCancel={() => setRenaming(null)}
            onSave={async (name) => {
              await update(c, { name }, "Categoría renombrada");
              setRenaming(null);
            }}
          />
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
            <span className="t-aux block truncate tabular-nums">
              {plural(usage.count, "movimiento", "movimientos")} en {monthName}
            </span>
          </span>
        )}

        <MoneyInput value={fieldValue(c)} onChange={(text) => setField(c, text)} label={`Presupuesto mensual de ${c.name}`} />

        <span className="min-w-0">
          <span className="flex items-baseline justify-between gap-2 text-[12.5px] tabular-nums">
            <span className="min-w-0 truncate">
              <span className="font-semibold text-ink">{money(usage.paid)}</span>
              {usage.pending > 0 ? <span className="text-muted"> + {money(usage.pending)} por pagar</span> : null}
              {!(budget > 0) ? <span className="text-muted"> · sin control</span> : null}
            </span>
            {budget > 0 ? <span className="shrink-0 text-muted">{Math.round((usage.paid / budget) * 100)}%</span> : null}
          </span>
          {budget > 0 ? <BudgetBar className="mt-1.5" paid={usage.paid} pending={usage.pending} budget={budget} color={c.color} dayPct={dayPct} /> : null}
        </span>

        <ActionsMenu size="row" items={items} />
      </div>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0 max-w-[560px]">
          <h2 className="t-card-title">
            Categorías de gasto <span className="font-normal text-muted">· {active.length}</span>
          </h2>
          <p className="t-aux mt-0.5">
            Las categorías que aparecen al registrar un gasto en Finanzas. El presupuesto es mensual, se repite cada mes hasta cambiarlo y es opcional.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="detail" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Ver activas" : `Archivadas · ${archived.length}`}
          </Button>
          <Button
            variant="soft"
            size="detail"
            icon={IconPlus}
            onClick={() => {
              setShowArchived(false);
              setAdding(true);
            }}
          >
            Nueva categoría
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3">
        <Stat
          label="Presupuesto mensual"
          value={money(budgetNow)}
          sub={delta === 0 ? "vigente este mes" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))} sin guardar`}
          subClass={delta === 0 ? "text-muted" : "font-semibold text-tone-amber-text"}
        />
        <Stat label={`Usado en ${monthName}`} value={money(paid)} sub={`${usedPct == null ? "sin presupuesto" : `${usedPct}%`} · día ${now.getDate()} de ${daysInMonth(now)}`} />
        <Stat label="Por pagar" value={money(pending)} sub="en facturas del mes" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft">
        {loading && !categories.length ? (
          <EmptyState title="Cargando…" />
        ) : error ? (
          <EmptyState title="No se pudo cargar la lista" description={error} />
        ) : (
          <>
            <div style={{ gridTemplateColumns: COLUMNS }} className="grid h-8 items-center gap-3 border-b border-line-soft bg-surface-2 px-5">
              <span />
              <span className="t-label">Categoría</span>
              <span className="t-label text-right">Presupuesto mensual</span>
              <span className="t-label">Usado en {monthName}</span>
              <span />
            </div>

            {list.length === 0 ? (
              <EmptyState title={showArchived ? "No hay categorías archivadas." : "Aún no hay categorías de gasto."} description={showArchived ? undefined : "Crea la primera con «Nueva categoría»."} />
            ) : showArchived ? (
              list.map((c) => {
                const Icon = categoryIcon(c.icon);
                return (
                  <div key={c._id} style={{ gridTemplateColumns: "34px minmax(0,1fr) auto" }} className={ROW}>
                    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-tone-gray text-tone-gray-text opacity-70">
                      <Icon width={16} height={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-muted">{c.name}</span>
                      <span className="t-aux block truncate">Archivada · {plural(c.usage?.count ?? 0, "movimiento", "movimientos")} en {monthName}</span>
                    </span>
                    <Button variant="secondary" size="row" onClick={() => restore(c)}>
                      Restaurar
                    </Button>
                  </div>
                );
              })
            ) : (
              list.map(renderRow)
            )}

            {!showArchived ? (
              <div style={{ gridTemplateColumns: "34px minmax(0,1fr) auto" }} className={`${ROW} bg-surface-2/70`}>
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-tone-gray text-tone-gray-text">
                  <IconOrders width={16} height={16} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                    Ventas
                    <span className="rounded-[6px] bg-tone-green px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-tone-green-text">automático</span>
                  </span>
                  <span className="t-aux block truncate">Fija. Solo la usan las ventas de la tienda y no lleva presupuesto.</span>
                </span>
                <span className="text-faint" title="Esta categoría no se puede cambiar">
                  <IconLock width={16} height={16} aria-label="Categoría fija" />
                </span>
              </div>
            ) : null}

            {adding && !showArchived ? (
              <form onSubmit={addCategory} className="m-5 flex flex-col gap-3.5 rounded-[12px] border border-dashed border-line px-4 py-3.5">
                <p className="text-[13px] font-semibold text-ink">Nueva categoría</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-ink-2">Nombre</span>
                    <input
                      autoFocus
                      value={fresh.name}
                      onChange={(e) => setFresh((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej. Papelería"
                      className={`${inputClass} w-full`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-ink-2">Presupuesto mensual (opcional)</span>
                    <MoneyInput value={fresh.budget} onChange={(budget) => setFresh((f) => ({ ...f, budget }))} label="Presupuesto mensual de la nueva categoría" />
                  </label>
                </div>
                <IconColorFields icon={fresh.icon} color={fresh.color} onChange={(patch) => setFresh((f) => ({ ...f, ...patch }))} />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="detail" onClick={() => setAdding(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="detail" disabled={saving}>
                    Agregar
                  </Button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </div>

      {changes.length ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-tone-amber-line bg-tone-amber px-5 py-3">
          <p className="flex min-w-0 flex-1 basis-[360px] items-start gap-2 text-[12.5px] text-tone-amber-strong">
            <IconAlert width={15} height={15} className="mt-px shrink-0" />
            <span>
              <span className="font-semibold">{plural(changes.length, "cambio sin guardar", "cambios sin guardar")}</span>
              {" · "}
              {changes
                .slice(0, 2)
                .map((c) => `${c.category.name} ${c.from == null ? "sin presupuesto" : money(c.from)} → ${Number.isNaN(c.to) ? "—" : c.to == null ? "sin presupuesto" : money(c.to)}`)
                .join(" · ")}
              {changes.length > 2 ? ` · y ${changes.length - 2} más` : ""} desde {monthName}. Los meses pasados conservan su presupuesto.
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="detail" onClick={() => setDraft({})} disabled={saving}>
              Descartar
            </Button>
            <Button size="detail" icon={IconCheck} onClick={saveBudgets} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      ) : null}

      {pickerCategory ? (
        <IconColorPicker
          anchorId={`category-icon-${pickerCategory._id}`}
          icon={pickerCategory.icon}
          color={pickerCategory.color}
          onChange={(patch) => changeStyle(pickerCategory, patch)}
          onClose={() => setPicker(null)}
        />
      ) : null}
      <ConfirmModal {...confirmProps} />
    </section>
  );
}

export default CategoriasGasto;
