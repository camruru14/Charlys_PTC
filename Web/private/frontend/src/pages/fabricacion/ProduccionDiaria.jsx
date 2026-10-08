import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import ActionsMenu from "../../components/ui/ActionsMenu";
import ColorSwatch from "../../components/ui/ColorSwatch";
import SearchInput from "../../components/ui/SearchInput";
import DataTable from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import { FilterSelect } from "../../components/ui/Field";
import { filterSelectClass } from "../../components/inventory/InventoryItemsCard";
import Pagination from "../../components/ui/Pagination";
import { usePagedRows } from "../../hooks/usePagedRows";
import { fmtNumber, fmtDateYear, fmtMonth, fromDateOnly } from "../../lib/format";
import { IconEdit } from "../../lib/icons";

// La fecha de un lote diario se guarda sin hora (medianoche UTC).
const dailyDate = (b) => fromDateOnly(b.date);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function currentMonthKey() {
  return monthKey(new Date());
}

/*
  Fabricación > Producción diaria: lotes diarios que se programan como lotes
  de fabricación. Buscador, filtro por mes, tabla y paginación.
*/
function ProduccionDiaria({ list, loading, error, busyId, onSchedule, onEdit, onDelete }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(currentMonthKey);

  // Meses con lotes (más reciente primero), más el actual.
  const monthOptions = useMemo(() => {
    const keys = new Map([[currentMonthKey(), new Date()]]);
    list.forEach((b) => {
      const d = dailyDate(b);
      if (d) keys.set(monthKey(d), d);
    });
    const years = new Set([...keys.values()].map((d) => d.getFullYear()));
    const sameYear = years.size === 1 && years.has(new Date().getFullYear());
    return [
      { value: "", label: "Fecha: todas" },
      ...[...keys.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([value, d]) => ({ value, label: `Fecha: ${fmtMonth(d)}${sameYear ? "" : ` ${d.getFullYear()}`}` })),
    ];
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((b) => {
      const d = dailyDate(b);
      if (month && (!d || monthKey(d) !== month)) return false;
      if (q && ![b.product, b.color, b.dailyBatchNumber].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, query, month]);

  const { cardRef, areaRef, cardStyle, visible, page, setPage, size, total, paged } = usePagedRows(filtered, { rowHeight: 44, headerHeight: 32, resetKey: `${query}|${month}` });

  const columns = [
    { key: "id", label: "ID", render: (b) => <span className="t-row-name tabular-nums">{b.dailyBatchNumber}</span> },
    { key: "date", label: "Fecha", render: (b) => <span className="tabular-nums">{fmtDateYear(dailyDate(b))}</span> },
    { key: "product", label: "Producto", render: (b) => b.product || "—" },
    {
      key: "color",
      label: "Color",
      render: (b) =>
        b.color ? (
          <span className="inline-flex items-center gap-2">
            <ColorSwatch color={b.color} />
            {b.color}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "target",
      label: "Meta",
      align: "right",
      render: (b) => <span className="tabular-nums">{b.targetQuantity ? fmtNumber(b.targetQuantity) : "—"}</span>,
    },
    {
      key: "actions",
      label: "Acciones",
      align: "right",
      width: "200px",
      render: (b) => (
        <div className="flex items-center justify-end gap-0.5">
          {/* Sin meta no se programa: el span lleva el motivo (un botón deshabilitado no siempre muestra su title). */}
          <span title={b.targetQuantity ? undefined : "Agrega la meta para programarlo"} className="mr-1 inline-flex">
            <Button variant="soft" size="row" disabled={busyId === b._id || !b.targetQuantity} onClick={() => onSchedule(b)}>
              Programar
            </Button>
          </span>
          <button
            type="button"
            onClick={() => onEdit(b)}
            aria-label={`Editar ${b.dailyBatchNumber}`}
            title="Editar"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconEdit width={15} height={15} />
          </button>
          <ActionsMenu size="row" items={[{ label: "Eliminar", onClick: () => onDelete(b), danger: true }]} />
        </div>
      ),
    },
  ];

  let body;
  if (loading && !list.length) body = <EmptyState title="Cargando lotes diarios…" />;
  else if (error) body = <EmptyState title="No se pudieron cargar los lotes diarios" description={error} />;
  else body = <DataTable columns={columns} rows={visible} empty={list.length ? "Ningún lote diario coincide con los filtros." : "No hay lotes diarios."} />;

  return (
    <section ref={cardRef} style={cardStyle} className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line-soft px-[18px] py-[13px]">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar producto"
          className="w-full sm:w-[260px]"
        />
        <FilterSelect value={month} onChange={(e) => setMonth(e.target.value)} options={monthOptions} className={filterSelectClass} />
      </div>
      <div ref={areaRef} className="min-h-0 flex-1 overflow-y-auto">
        {body}
      </div>
      {paged ? (
        <Pagination page={page} size={size} total={total} noun="lotes diarios" onChange={setPage} />
      ) : (
        <div className="flex h-[38px] shrink-0 items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-[18px]">
          <p className="t-aux tabular-nums">
            {fmtNumber(filtered.length)} de {fmtNumber(list.length)} lotes diarios
          </p>
        </div>
      )}
    </section>
  );
}

export default ProduccionDiaria;
