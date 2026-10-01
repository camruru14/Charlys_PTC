import StatusPill from "../ui/StatusPill";
import EmptyState from "../ui/EmptyState";
import ActionsMenu from "../ui/ActionsMenu";
import { fmtDate, fmtMoney, fromDateOnly } from "../../lib/format";

/*
  Tabla de transacciones (Finanzas e Historial de transacciones).
  Columnas 124px 88px minmax(0,1fr) 150px 116px 124px: Referencia · Fecha ·
  Concepto (con el pedido vinculado) · Categoría · Monto · Estado; filas de
  42px. Con onEdit/onDelete agrega un menú «…» por fila.
*/

const COLUMNS = "124px 88px minmax(0,1fr) 150px 116px 124px";

// date se guarda como medianoche UTC (fecha sin hora); createdAt es un instante real.
const txDay = (t) => (t.date ? fromDateOnly(t.date) : t.createdAt);

function Amount({ t }) {
  const income = t.type === "Ingreso";
  return (
    <span className={`font-semibold tabular-nums ${income ? "text-tone-green-text" : "text-tone-rose-text"}`}>
      {income ? "+" : "−"}
      {fmtMoney(Math.abs(Number(t.amount) || 0))}
    </span>
  );
}

function TransactionTable({ transactions = [], onEdit, onDelete, empty = "No hay transacciones con esos criterios." }) {
  if (transactions.length === 0) return <EmptyState title={empty} />;

  const showActions = Boolean(onEdit || onDelete);
  const grid = { gridTemplateColumns: showActions ? `${COLUMNS} 40px` : COLUMNS };

  return (
    // Sin overflow en pantallas anchas, para que el menú «…» de las últimas filas no se recorte.
    <div className="max-lg:overflow-x-auto">
      <div className="min-w-[760px]">
        <div style={grid} className="grid h-8 items-center gap-3 border-b border-line-soft bg-surface-2 px-5">
          <span className="t-label">Referencia</span>
          <span className="t-label">Fecha</span>
          <span className="t-label">Concepto</span>
          <span className="t-label">Categoría</span>
          <span className="t-label text-right">Monto</span>
          <span className="t-label">Estado</span>
          {showActions ? <span /> : null}
        </div>
        {transactions.map((t) => (
          <div key={t._id} style={grid} className="grid h-[42px] items-center gap-3 border-b border-line-soft px-5 last:border-0">
            <span className="truncate text-[12.5px] font-semibold tabular-nums text-ink-2">{t.reference || "—"}</span>
            <span className="t-row tabular-nums">{fmtDate(txDay(t))}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-ink">{t.concept || "—"}</span>
              {t.relatedOrder?.orderNumber ? (
                <span className="shrink-0 rounded-[6px] bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary-soft-text">
                  {t.relatedOrder.orderNumber}
                </span>
              ) : null}
            </span>
            <span className="t-row truncate text-ink-2">{t.category || "—"}</span>
            <span className="text-right text-[13px]">
              <Amount t={t} />
            </span>
            <span>
              <StatusPill status={t.status} domain="transaccion" />
            </span>
            {showActions ? (
              <ActionsMenu
                size="row"
                items={[
                  ...(onEdit ? [{ label: "Editar", onClick: () => onEdit(t) }] : []),
                  ...(onDelete ? [{ label: "Eliminar", onClick: () => onDelete(t), danger: true }] : []),
                ]}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TransactionTable;
