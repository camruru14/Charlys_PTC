import { useMemo, useState } from "react";
import Avatar from "../../components/ui/Avatar";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import FilterChips from "../../components/ui/FilterChips";
import SearchInput from "../../components/ui/SearchInput";
import StatusPill from "../../components/ui/StatusPill";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../../components/ui/MasterDetail";
import { attendanceStatus, employeeMonthRows, fmtHours, monthLabel, recordHours } from "../../lib/attendance";
import { fmtDateYear, fmtMoney, fmtTime, fmtWeekdayDate } from "../../lib/format";
import { IconUsers } from "../../lib/icons";

const fullName = (emp) => `${emp.name || ""} ${emp.lastName || ""}`.trim();
const employeeStatus = (emp) => (emp.isActive !== false ? "Activo" : "Inactivo");
const roleLine = (emp) => [emp.position, emp.department].filter(Boolean).join(" · ");

// DUI se guarda como 9 dígitos; se muestra con guion antes del último dígito (8-1)
function formatDui(dui) {
  const digits = String(dui || "").replace(/\D/g, "");
  if (digits.length !== 9) return dui;
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function matches(emp, query, area) {
  if (area !== "all" && emp.department !== area) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fullName(emp), emp.position, emp.department, emp.email].some((v) => (v || "").toLowerCase().includes(q));
}

function EmployeeRow({ emp, selected, onSelect }) {
  const role = roleLine(emp);
  return (
    <ListRow selected={selected} onClick={onSelect}>
      <span className="flex items-center gap-3">
        <Avatar person={emp} size={32} tone="color" />
        <span className="min-w-0 flex-1">
          <span className="t-row-name block truncate">{fullName(emp)}</span>
          {role ? <span className="t-aux block truncate">{role}</span> : null}
        </span>
        <StatusPill status={employeeStatus(emp)} domain="empleado" variant="dot" />
      </span>
    </ListRow>
  );
}

function attendanceColumns(schedule) {
  return [
    {
      key: "date",
      label: "Fecha",
      width: "132px",
      render: (r) => <span className="whitespace-nowrap tabular-nums">{fmtWeekdayDate(r.date)}</span>,
    },
    { key: "in", label: "Entrada", width: "92px", render: (r) => <span className="tabular-nums">{r.record ? fmtTime(r.record.checkIn) : "—"}</span> },
    { key: "out", label: "Salida", width: "92px", render: (r) => <span className="tabular-nums">{r.record ? fmtTime(r.record.checkOut) : "—"}</span> },
    {
      key: "hours",
      label: "Horas",
      width: "84px",
      align: "right",
      render: (r) => (r.record ? fmtHours(recordHours(r.record, schedule).worked) : "—"),
    },
    {
      key: "extra",
      label: "Extra",
      width: "84px",
      align: "right",
      render: (r) => {
        const overtime = r.record ? recordHours(r.record, schedule).overtime : 0;
        return overtime > 0.005 ? <span className="font-semibold text-tone-blue-text">{fmtHours(overtime)}</span> : <span className="text-muted">—</span>;
      },
    },
    {
      key: "status",
      label: "Estado",
      render: (r) => <StatusPill status={r.record ? attendanceStatus(r.record, schedule) : "Ausente"} domain="asistencia" />,
    },
  ];
}

function DataItem({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="t-label">{label}</p>
      <p className="t-row mt-1 truncate">{children}</p>
    </div>
  );
}

function EmployeeDetail({ emp, days, month, schedule, onEdit, onRegister }) {
  const rows = useMemo(() => employeeMonthRows(emp, days), [emp, days]);
  const columns = useMemo(() => attendanceColumns(schedule), [schedule]);
  const role = roleLine(emp);
  const dui = emp.dui ? formatDui(emp.dui) : null;

  const data = [
    emp.phone ? { label: "Teléfono", value: emp.phone } : null,
    emp.email ? { label: "Correo", value: emp.email } : null,
    emp.hourlyRate != null ? { label: "Valor por hora", value: fmtMoney(emp.hourlyRate) } : null,
    emp.hireDate ? { label: "Fecha de ingreso", value: fmtDateYear(emp.hireDate) } : null,
  ].filter(Boolean);

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar person={emp} size={48} tone="color" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-[19px] font-bold tracking-[-0.02em] text-ink">{fullName(emp)}</h2>
                <StatusPill status={employeeStatus(emp)} domain="empleado" size="lg" />
              </div>
              {role || dui ? (
                <p className="t-aux mt-0.5 tabular-nums">{[role, dui ? `DUI ${dui}` : null].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" size="detail" onClick={() => onRegister(emp)}>
              Registrar asistencia
            </Button>
            <Button variant="secondary" size="detail" onClick={() => onEdit(emp)}>
              Editar
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="t-card-title">Asistencia · {monthLabel(month)}</h3>
          <div className="overflow-hidden rounded-[12px] border border-line-soft">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey="key"
              rowClassName={(r) => (r.record ? "" : "bg-row-alert")}
              empty={`Sin marcaciones en ${monthLabel(month)}.`}
            />
          </div>
        </section>

        {data.length ? (
          <section className="flex flex-col gap-3">
            <h3 className="t-card-title">Datos del empleado</h3>
            <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-line-soft bg-surface-2 px-4 py-3.5 sm:grid-cols-2">
              {data.map((d) => (
                <DataItem key={d.label} label={d.label}>
                  {d.value}
                </DataItem>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </DetailPanel>
  );
}

/*
  Personal: lista de empleados (392px) con búsqueda y chips por área, y la
  ficha del seleccionado (?id=) con su asistencia del mes y sus datos.
*/
function Personal({ employees, days, month, schedule, loading, error, selectedId, onSelect, onEdit, onRegister }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");

  const areaOptions = useMemo(() => {
    const counts = new Map();
    employees.forEach((e) => e.department && counts.set(e.department, (counts.get(e.department) || 0) + 1));
    return [
      { key: "all", label: "Todos", count: employees.length },
      ...[...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "es")).map(([name, count]) => ({ key: name, label: name, count })),
    ];
  }, [employees]);

  const visible = useMemo(
    () => employees.filter((e) => matches(e, query, area)).sort((a, b) => fullName(a).localeCompare(fullName(b), "es")),
    [employees, query, area],
  );

  const selected = employees.find((e) => String(e._id) === selectedId) || visible[0] || null;

  let list;
  if (loading) list = <EmptyState title="Cargando empleados…" />;
  else if (error) list = <EmptyState title="No se pudo cargar el personal" description={error} />;
  else if (visible.length === 0) list = <EmptyState title={employees.length ? "Ningún empleado coincide." : "No hay empleados."} />;
  else
    list = visible.map((emp) => (
      <EmployeeRow key={emp._id} emp={emp} selected={selected?._id === emp._id} onSelect={() => onSelect(String(emp._id))} />
    ));

  return (
    <MasterDetail listWidth={392}>
      <ListPanel
        header={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar empleado" />
            <FilterChips options={areaOptions} value={area} onChange={setArea} />
          </>
        }
      >
        {list}
      </ListPanel>
      {selected ? (
        <EmployeeDetail emp={selected} days={days} month={month} schedule={schedule} onEdit={onEdit} onRegister={onRegister} />
      ) : (
        <section className="flex items-center justify-center rounded-[14px] border border-line bg-surface">
          <EmptyState icon={IconUsers} title="Selecciona un empleado" />
        </section>
      )}
    </MasterDetail>
  );
}

export default Personal;
