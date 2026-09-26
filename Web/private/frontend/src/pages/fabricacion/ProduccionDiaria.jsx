import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import ActionsMenu from "../../components/ui/ActionsMenu";
import ColorSwatch from "../../components/ui/ColorSwatch";
import SearchInput from "../../components/ui/SearchInput";
import DataTable from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import { FilterSelect } from "../../components/ui/Field";
import { Pagination, PAGE_SIZE, filterSelectClass } from "../../components/inventory/InventoryItemsCard";
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
  const [page, setPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      key: "actions",
      label: "Acciones",
      align: "right",
      width: "200px",
      render: (b) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="soft" size="row" disabled={busyId === b._id} onClick={() => onSchedule(b)} className="mr-1">
            Programar
          </Button>
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
  else body = <DataTable columns={columns} rows={rows} empty={list.length ? "Ningún lote diario coincide con los filtros." : "No hay lotes diarios."} />;

  return (
    <section className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-[18px] py-[13px]">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Buscar producto"
          className="w-full sm:w-[260px]"
        />
        <FilterSelect
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
          options={monthOptions}
          className={filterSelectClass}
        />
      </div>
      {body}
      <div className="flex h-[38px] items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-[18px]">
        <p className="t-aux tabular-nums">
          {fmtNumber(filtered.length)} de {fmtNumber(list.length)} lotes diarios
        </p>
        <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
      </div>
    </section>
  );
}

export default ProduccionDiaria;
