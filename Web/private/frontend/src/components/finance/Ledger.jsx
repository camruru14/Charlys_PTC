import { Fragment, useState } from "react";
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
  franja con las cifras del rango y la lista agrupada por día. Lo manual lleva
  su menú (editar, marcar pagado, ver factura, eliminar); las ventas de la
  tienda se juntan en UNA fila por día, se expanden y no se editan.
*/

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 32;
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

function Cell({ label, value, valueClass = "text-ink", sub }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <p className="t-label truncate">{label}</p>
      <p className={`mt-0.5 truncate text-[17px] font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="t-aux truncate">{sub}</p>
    </div>
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

function SalesRow({ sales, open, onToggle }) {
  const total = sales.reduce((s, t) => s + (Number(t.amount) || 0), 0);
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
        ? sales.map((t) => (
            <div key={t._id} style={{ gridTemplateColumns: COLUMNS }} className="grid h-9 items-center gap-3 border-b border-line-soft bg-surface-2/40 px-4 text-[12.5px]">
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
  onEdit,
  onPay,
  onDelete,
  resetKey,
  loading,
  error,
  now = new Date(),
}) {
  const { cardRef, areaRef, cardStyle, visible, page, setPage, pages, from, to, total, paged } = usePagedGroups(rows, {
    rowHeight: ROW_HEIGHT,
    headerHeight: HEADER_HEIGHT,
    groupOf: (r) => r.day,
    resetKey,
  });
  const [openDays, setOpenDays] = useState(() => new Set());
  const toggleDay = (key) =>
    setOpenDays((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
          <SalesRow sales={row.sales} open={openDays.has(row.day)} onToggle={() => toggleDay(row.day)} />
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
    <section ref={cardRef} style={cardStyle} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface" aria-label="Movimientos">
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

      <div className="grid shrink-0 grid-cols-2 divide-x divide-line-soft border-y border-line-soft xl:grid-cols-4">
        <Cell
          label="Ventas de la tienda"
          value={money(summary.sales)}
          sub={`${plural(summary.salesCount, "pedido", "pedidos")}${summary.otherIncome > 0 ? ` · + ${money(summary.otherIncome)} otros ingresos` : ""}`}
        />
        <Cell label="Gastos pagados" value={money(summary.expensesPaid)} sub="en el rango" />
        <Cell
          label="Neto"
          value={`${net > 0 ? "+" : net < 0 ? "−" : ""}${money(Math.abs(net))}`}
          valueClass={net > 0 ? "text-tone-green-text" : net < 0 ? "text-tone-rose-text" : "text-ink"}
          sub={summary.netPct == null ? "sin ingresos" : `${Math.round(summary.netPct)}% de los ingresos`}
        />
        <Cell label="Por pagar" value={money(summary.pending)} valueClass="text-tone-amber-text" sub={plural(summary.pendingCount, "factura", "facturas")} />
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
