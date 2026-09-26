import { useMemo, useState } from "react";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/ui/SearchInput";
import StatusPill from "../../components/ui/StatusPill";
import { FilterSelect } from "../../components/ui/Field";
import { Pagination } from "../../components/inventory/InventoryItemsCard";
import { filterSelectClass } from "../../lib/filterStyles";
import {
  TIMELINE_TICKS,
  fmtHours,
  monthLabel,
  recordHours,
  timelineBar,
} from "../../lib/attendance";
import { fmtDayLong, fmtNumber } from "../../lib/format";

const PAGE_SIZE = 30;
const GRID = "grid grid-cols-[232px_minmax(0,1fr)_72px] items-center gap-4 px-5";

const fullName = (emp) => `${emp.name || ""} ${emp.lastName || ""}`.trim();
const tickLeft = (h) => `${((h - TIMELINE_TICKS[0]) / (TIMELINE_TICKS.at(-1) - TIMELINE_TICKS[0])) * 100}%`;

// Líneas verticales de las marcas horarias, de fondo en cada franja.
function TickLines() {
  return TIMELINE_TICKS.map((h) => (
    <span key={h} className="absolute inset-y-0 w-px bg-line-soft" style={{ left: tickLeft(h) }} />
  ));
}

function TimelineBar({ record, schedule }) {
  const bar = timelineBar(record, schedule);
  if (!bar) return <span className="t-aux relative">Sin entrada o salida</span>;
  return (
    <span
      className="absolute top-1/2 flex h-[22px] -translate-y-1/2 overflow-hidden rounded-[6px]"
      style={{ left: `${bar.left}%`, width: `${bar.workday + bar.extra}%` }}
      title={`${bar.checkIn} – ${bar.checkOut}`}
    >
      <span className="h-full bg-tone-blue-dot" style={{ width: `${(bar.workday / (bar.workday + bar.extra)) * 100}%` }} />
      {bar.extra > 0 ? <span className="h-full flex-1 bg-tone-amber-dot" /> : null}
      <span className="absolute inset-0 flex items-center justify-between px-1.5 text-[10.5px] font-semibold tabular-nums text-white">
        <span>{bar.checkIn}</span>
        <span>{bar.checkOut}</span>
      </span>
    </span>
  );
}

function PersonCell({ emp }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar person={emp} tone="color" />
      <span className="t-row-name truncate">{fullName(emp)}</span>
    </span>
  );
}

/*
  Asistencia: marcaciones del mes agrupadas por día, sobre una franja de
  06:00 a 18:00 (jornada en azul, hora extra en ámbar). Los empleados activos
  sin marcación en un día con marcaciones aparecen como «Ausente».
*/
function Asistencia({ days, months, month, onMonth, schedule, loading, error }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Filas planas (encabezado de día + marcaciones + ausentes), filtradas por nombre.
  const { rows, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (emp) => !q || fullName(emp).toLowerCase().includes(q);
    const out = [];
    let count = 0;
    days.forEach((day) => {
      const entries = day.entries.filter((e) => match(e.employee));
      const absent = day.absent.filter(match);
      if (!entries.length && !absent.length) return;
      count += entries.length;
      entries.forEach((e) => out.push({ type: "entry", day, ...e }));
      absent.forEach((emp) => out.push({ type: "absent", day, key: `${day.key}-${emp._id}`, employee: emp }));
    });
    return { rows: out, total: count };
  }, [days, query]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const shown = pageRows.filter((r) => r.type === "entry").length;

  // Agrupa la página por día; el conteo del subtítulo es del día completo.
  const groups = [];
  pageRows.forEach((r) => {
    const last = groups.at(-1);
    if (last?.day === r.day) last.rows.push(r);
    else groups.push({ day: r.day, rows: [r] });
  });

  const monthOptions = (months.includes(month) ? months : [month, ...months]).map((m) => ({ value: m, label: `Mes: ${monthLabel(m)}` }));

  let body;
  if (loading) body = <EmptyState title="Cargando marcaciones…" />;
  else if (error) body = <EmptyState title="No se pudo cargar la asistencia" description={error} />;
  else if (!rows.length) body = <EmptyState title={days.length ? "Ningún empleado coincide." : `Sin marcaciones en ${monthLabel(month)}.`} />;
  else
    body = groups.map(({ day, rows: dayRows }) => (
      <div key={day.key}>
        <div className="flex h-9 items-center justify-between border-b border-line-soft bg-surface-2 px-5">
          <span className="text-[12.5px] font-semibold text-ink">{fmtDayLong(day.date)}</span>
          <span className="t-aux tabular-nums">
            {fmtNumber(day.entries.length)} {day.entries.length === 1 ? "marcación" : "marcaciones"}
          </span>
        </div>
        {dayRows.map((r) =>
          r.type === "entry" ? (
            <div key={r.key} className={`${GRID} h-[48px] border-b border-line-soft`}>
              <PersonCell emp={r.employee} />
              <span className="relative flex h-full items-center">
                <TickLines />
                <TimelineBar record={r.record} schedule={schedule} />
              </span>
              <span className="text-right text-[13px] font-semibold tabular-nums text-ink">{fmtHours(recordHours(r.record, schedule).worked)}</span>
            </div>
          ) : (
            <div key={r.key} className={`${GRID} h-[48px] border-b border-line-soft bg-row-alert`}>
              <PersonCell emp={r.employee} />
              <span className="relative flex h-full items-center">
                <TickLines />
                <span className="relative">
                  <StatusPill status="Ausente" domain="asistencia" />
                </span>
              </span>
              <span className="text-right text-[13px] text-muted">—</span>
            </div>
          ),
        )}
      </div>
    ));

  return (
    <section className="overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Buscar empleado"
          className="w-full sm:w-[240px]"
        />
        <FilterSelect
          value={month}
          onChange={(e) => {
            onMonth(e.target.value);
            setPage(1);
          }}
          className={filterSelectClass}
          options={monthOptions}
        />
        <div className="ml-auto flex items-center gap-4 text-[12px] font-semibold text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-tone-blue-dot" /> Jornada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-tone-amber-dot" /> Hora extra
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-line-soft">
        <div className="min-w-[760px]">
          <div className={`${GRID} h-8 border-b border-line-soft bg-surface-2`}>
            <span className="t-label">Empleado</span>
            <span className="relative h-full">
              {TIMELINE_TICKS.map((h, i) => (
                <span
                  key={h}
                  className={`t-label absolute top-1/2 -translate-y-1/2 tabular-nums ${
                    i === 0 ? "" : i === TIMELINE_TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
                  }`}
                  style={{ left: tickLeft(h) }}
                >
                  {h}:00
                </span>
              ))}
            </span>
            <span className="t-label text-right">Horas</span>
          </div>
          {body}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface-2 px-5 py-2.5">
        <span className="t-aux tabular-nums">
          {fmtNumber(shown)} de {fmtNumber(total)} marcaciones · {monthLabel(month, { withYear: true })}
        </span>
        {pageCount > 1 ? <Pagination page={current} pageCount={pageCount} onPage={setPage} /> : null}
      </div>
    </section>
  );
}

export default Asistencia;
