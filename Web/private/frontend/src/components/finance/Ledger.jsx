import { Fragment, useEffect, useRef, useState } from "react";
import ActionsMenu from "../ui/ActionsMenu";
import EmptyState from "../ui/EmptyState";
import { FilterSelect } from "../ui/Field";
import ListGroupHeader from "../ui/ListGroupHeader";
import Pagination from "../ui/Pagination";
import SearchInput from "../ui/SearchInput";
import StatusPill from "../ui/StatusPill";
import Tabs from "../ui/Tabs";
import { AsyncState } from "../ui/SectionCard";
import { usePagedGroups } from "../../hooks/usePagedGroups";
import { IconBank, IconCard, IconCash, IconChevronDown, IconDoc, IconDollar, IconDownload, IconLock, IconOrders, IconPaperclip, IconTag } from "../../lib/icons";
import { categoryIcon, categoryTone } from "../../lib/expenseCategories";
import { dayLabel, dueText, LEDGER_TABS, money, orderRangeText, plural } from "../../lib/finance";
import { fmtTime } from "../../lib/format";
import { filterSelectClass } from "../../lib/filterStyles";
import { statusLabel } from "../../lib/transactionFilters";

/*
  Libro de movimientos de Finanzas (columna derecha): pestañas, filtros, una
  franja de una línea (36 px) con las cifras del rango y la lista agrupada por día. Lo manual lleva
  su menú (editar, marcar pagado, ver factura, eliminar); las ventas de la
  tienda se juntan en UNA fila por día, se expanden y no se editan. Abrir una venta no cambia la
  paginación: las páginas se arman solo con filas y encabezados de día, y el área de filas hace scroll
  por dentro cuando las subfilas no caben (la página no hace scroll).
*/

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 32;
const SUBROWS_PREVIEW = 6; // pedidos que muestra una venta abierta antes de «Ver los N pedidos»
const COLUMNS = "minmax(0,1fr) 116px 100px 108px 32px";
const METHOD_ICONS = { Efectivo: IconCash, Transferencia: IconBank, Cheque: IconDoc, Wompi: IconCard };
const LOCKED = "Las ventas de la tienda no se editan";

function Avatar({ icon: Icon, className }) {
  return (
    <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${className}`}>
      <Icon width={16} height={16} />
    </span>
  );
}

function Method({ method }) {
  if (!method) return <span className="text-[12.5px] text-faint">—</span>;
  const Icon = METHOD_ICONS[method] || IconCash;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2">
      <Icon width={14} height={14} className="shrink-0 text-subtle" />
      <span className="truncate">{method}</span>
    </span>
  );
}

function Amount({ value, income }) {
  return (
    <span className={`text-right text-[13px] font-semibold tabular-nums ${income ? "text-tone-green-text" : "text-ink"}`}>
      {income ? "+" : "−"}
      {money(Math.abs(Number(value) || 0))}
    </span>
  );
}

// Un grupo de la franja de cifras: etiqueta gris, monto en negrita y un dato breve. Se trunca, no envuelve.
function StripGroup({ label, value, valueClass = "text-ink", sub }) {
  return (
    <span className="min-w-0 truncate">
      <span className="text-[12px] text-muted">{label}</span>{" "}
      <span className={`text-[13.5px] font-bold tabular-nums ${valueClass}`}>{value}</span>
      {sub ? <span className="text-[12px] tabular-nums text-muted">{` ${sub}`}</span> : null}
    </span>
  );
}

function ManualRow({ tx, categoryByName, now, highlighted, onEdit, onPay, onDelete }) {
  const income = tx.type === "Ingreso";
  const category = categoryByName.get(tx.category);
  const Icon = income ? IconDollar : categoryIcon(category?.icon);
  const tone = income ? "bg-tone-green text-tone-green-text" : categoryTone(category?.color).soft;
  const due = dueText(tx, now);
  const items = [
    { label: "Editar", onClick: () => onEdit(tx) },
    ...(tx.status === "Pendiente" ? [{ label: "Marcar pagado", onClick: () => onPay(tx) }] : []),
    ...(tx.attachment?.url ? [{ label: "Ver factura", onClick: () => window.open(tx.attachment.url, "_blank", "noopener,noreferrer") }] : []),
    { label: "Eliminar", onClick: () => onDelete(tx), danger: true },
  ];
  return (
    <div
      style={{ gridTemplateColumns: COLUMNS, height: ROW_HEIGHT }}
      className={`grid items-center gap-3 border-b border-line-soft px-4 transition-colors duration-[1500ms] ${highlighted ? "bg-tone-green/70" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar icon={Icon} className={tone} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
            <span className="truncate">{tx.concept || "—"}</span>
            {tx.attachment?.url ? <IconPaperclip width={13} height={13} className="shrink-0 text-subtle" aria-label="Tiene factura" /> : null}
          </p>
          <p className="t-aux truncate">
            {tx.category || "—"} · <span className="tabular-nums">{tx.reference}</span>
            {due ? <span className={due.overdue ? "font-semibold text-tone-rose-text" : ""}>{` · ${due.text}`}</span> : null}
          </p>
        </div>
      </div>
      <Method method={tx.paymentMethod} />
      <span>
        <StatusPill status={statusLabel(tx, now)} domain="movimiento" />
      </span>
      <Amount value={tx.amount} income={income} />
      <ActionsMenu size="row" items={items} />
    </div>
  );
}

function SalesRow({ sales, day, open, showAll, onToggle, onShowAll }) {
  const total = sales.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  // Una venta con muchos pedidos muestra los primeros y «Ver los N pedidos» para el resto.
  const preview = showAll ? sales : sales.slice(0, SUBROWS_PREVIEW);
  const hidden = sales.length - preview.length;
  return (
    <>
      <div style={{ gridTemplateColumns: COLUMNS, height: ROW_HEIGHT }} className="grid items-center gap-3 border-b border-line-soft bg-surface-2/40 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Ocultar los pedidos" : "Ver los pedidos"}
            title={open ? "Ocultar los pedidos" : "Ver los pedidos"}
            onClick={onToggle}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconChevronDown width={15} height={15} className={`transition ${open ? "" : "-rotate-90"}`} />
          </button>
          <Avatar icon={IconOrders} className="bg-tone-green text-tone-green-text" />
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink">
              <span className="truncate" title={`Ventas de la tienda · ${plural(sales.length, "pedido", "pedidos")}`}>
                Ventas de la tienda · {plural(sales.length, "pedido", "pedidos")}
              </span>
              <span className="shrink-0 rounded-[6px] bg-tone-green px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-tone-green-text">automático</span>
            </p>
            <p className="t-aux truncate tabular-nums">{orderRangeText(sales)} · no se editan</p>
          </div>
        </div>
        <Method method="Wompi" />
        <span>
          <StatusPill status="Pagado" domain="movimiento" />
        </span>
        <Amount value={total} income />
        <span className="flex justify-center text-faint" title={LOCKED}>
          <IconLock width={15} height={15} aria-label={LOCKED} />
        </span>
      </div>
      {open
        ? preview.map((t, i) => (
            <div
              key={t._id}
              data-last-sub={hidden === 0 && i === preview.length - 1 ? day : undefined}
              style={{ gridTemplateColumns: COLUMNS }}
              className="grid h-9 items-center gap-3 border-b border-line-soft bg-surface-2/40 px-4 text-[12.5px]"
            >
              <span className="truncate pl-[84px] tabular-nums text-ink-2">
                {t.relatedOrder?.orderNumber || t.orderNumber || t.reference}
                <span className="ml-2 text-muted">{t.date ? fmtTime(t.date) : ""}</span>
              </span>
              <span />
              <span />
              <Amount value={t.amount} income />
              <span />
            </div>
          ))
        : null}
      {open && hidden > 0 ? (
        <div data-last-sub={day} style={{ gridTemplateColumns: COLUMNS }} className="grid h-9 items-center gap-3 border-b border-line-soft bg-surface-2/40 px-4 text-[12.5px]">
          <button type="button" onClick={onShowAll} className="justify-self-start pl-[84px] font-semibold text-primary-soft-text transition hover:text-primary">
            Ver los {sales.length} pedidos
          </button>
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </>
  );
}

function Ledger({
  rows,
  days,
  summary,
  categoryByName,
  categoryOptions,
  tab,
  onTab,
  pendingCount,
  category,
  onCategory,
  query,
  onQuery,
  onExport,
  highlightId,
  fill,
  onEdit,
  onPay,
  onDelete,
  resetKey,
  loading,
  error,
  now = new Date(),
}) {
  // Ventas abiertas ({ open, all }: días) y a qué página/filtros pertenecen: al cambiar de página,
  // rango, pestaña, categoría o búsqueda se cierran todas.
  const [expanded, setExpanded] = useState({ key: "", open: new Set(), all: new Set() });
  const scrollToDay = useRef(null);
  // `fill`: la grilla de Finanzas ya fija el alto del libro (una sola medición); aquí solo se
  // reparten las filas en páginas según el alto del área. Abrir una venta NO las vuelve a repartir.
  const { cardRef, areaRef, visible, page, setPage, pages, from, to, total, paged } = usePagedGroups(rows, {
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    groupOf: (r) => r.day,
    fill,
    resetKey,
  });
  const viewKey = `${resetKey}|${page}`;
  const current = expanded.key === viewKey ? expanded : { open: new Set(), all: new Set() };
  const update = (patch) => setExpanded({ key: viewKey, open: current.open, all: current.all, ...patch });
  const toggleDay = (day) => {
    const open = new Set(current.open);
    if (open.has(day)) {
      open.delete(day);
      const all = new Set(current.all);
      all.delete(day);
      update({ open, all });
    } else {
      open.add(day);
      scrollToDay.current = day;
      update({ open });
    }
  };
  const showAllOf = (day) => {
    scrollToDay.current = day;
    update({ all: new Set(current.all).add(day) });
  };

  // Al cambiar de página o de filtros, el área regresa arriba.
  useEffect(() => {
    if (areaRef.current) areaRef.current.scrollTop = 0;
  }, [viewKey, areaRef]);

  // Al abrir una venta (o desplegar todos sus pedidos), se desplaza el área lo justo para ver su última subfila.
  useEffect(() => {
    const day = scrollToDay.current;
    if (!day) return;
    scrollToDay.current = null;
    areaRef.current?.querySelector(`[data-last-sub="${day}"]`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, areaRef]);

  const net = summary.net;
  const tabs = LEDGER_TABS.map((t) => (t.key === "porpagar" ? { ...t, label: `Por pagar (${pendingCount})` } : t));

  // Los encabezados de día se arman con las filas de la página.
  const body = [];
  let last = null;
  for (const row of visible) {
    if (row.day !== last) {
      const day = days.get(row.day);
      const count = day.manual.length + day.sales.length;
      body.push(
        <ListGroupHeader
          key={`h-${row.day}`}
          label={dayLabel(day.date, now)}
          note={plural(count, "movimiento", "movimientos")}
          count={
            <span className={`font-semibold ${day.net > 0 ? "text-tone-green-text" : day.net < 0 ? "text-tone-rose-text" : ""}`}>
              {day.net > 0 ? "+" : day.net < 0 ? "−" : ""}
              {money(Math.abs(day.net))}
            </span>
          }
        />,
      );
      last = row.day;
    }
    body.push(
      row.kind === "sales" ? (
        <Fragment key={row.id}>
          <SalesRow sales={row.sales} day={row.day} open={current.open.has(row.day)} showAll={current.all.has(row.day)} onToggle={() => toggleDay(row.day)} onShowAll={() => showAllOf(row.day)} />
        </Fragment>
      ) : (
        <ManualRow
          key={row.id}
          tx={row.tx}
          categoryByName={categoryByName}
          now={now}
          highlighted={highlightId === row.id}
          onEdit={onEdit}
          onPay={onPay}
          onDelete={onDelete}
        />
      ),
    );
  }

  return (
    <section ref={cardRef} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface" aria-label="Movimientos">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-3.5">
        <Tabs tabs={tabs} value={tab} onChange={onTab} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <FilterSelect value={category} onChange={(e) => onCategory(e.target.value)} options={categoryOptions} className={`${filterSelectClass} !min-w-[176px]`} />
          <SearchInput value={query} onChange={onQuery} placeholder="Concepto o referencia" className="w-[200px]" />
          <button
            type="button"
            onClick={onExport}
            aria-label="Exportar a CSV"
            title="Exportar a CSV lo que se ve"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-surface text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <IconDownload width={16} height={16} />
          </button>
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-y border-line-soft bg-surface-2 px-5" aria-label="Resumen del rango">
        <StripGroup
          label="Ventas tienda"
          value={money(summary.sales)}
          valueClass="text-tone-green-text"
          sub={`${plural(summary.salesCount, "pedido", "pedidos")}${summary.otherIncome > 0 ? ` · + ${money(summary.otherIncome)} otros` : ""}`}
        />
        <span className="h-4 w-px shrink-0 bg-line" />
        <StripGroup label="Gastos pagados" value={`${summary.expensesPaid > 0 ? "−" : ""}${money(summary.expensesPaid)}`} />
        <span className="h-4 w-px shrink-0 bg-line" />
        <StripGroup
          label="Neto"
          value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${money(Math.abs(net))}`}
          valueClass={net > 0 ? "text-tone-green-text" : net < 0 ? "text-tone-rose-text" : "text-ink"}
          sub={summary.netPct == null ? "sin ingresos" : `${Math.round(summary.netPct)}%`}
        />
        <span className="h-4 w-px shrink-0 bg-line" />
        <StripGroup label="Por pagar" value={money(summary.pending)} valueClass="text-tone-amber-text" sub={plural(summary.pendingCount, "factura", "facturas")} />
      </div>

      {/* En pantallas angostas la tabla conserva su ancho y se desplaza de lado. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 min-w-[640px] flex-1 flex-col">
          <div style={{ gridTemplateColumns: COLUMNS }} className="grid h-8 shrink-0 items-center gap-3 border-b border-line-soft bg-surface-2 px-4">
            <span className="t-label">Movimiento</span>
            <span className="t-label">Método</span>
            <span className="t-label">Estado</span>
            <span className="t-label text-right">Monto</span>
            <span />
          </div>

          <div ref={areaRef} className="min-h-0 flex-1 overflow-y-auto">
            <AsyncState loading={loading} error={error}>
              {rows.length === 0 ? <EmptyState icon={IconTag} title="No hay movimientos con esos criterios." description="Prueba con otro rango, pestaña o categoría." /> : body}
            </AsyncState>
          </div>
        </div>
      </div>

      {paged ? <Pagination page={page} size={0} total={total} pages={pages} from={from} to={to} noun="movimientos" onChange={setPage} /> : null}
    </section>
  );
}

export default Ledger;
