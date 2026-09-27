import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import FilterChips from "../../components/ui/FilterChips";
import SearchInput from "../../components/ui/SearchInput";
import StatusPill from "../../components/ui/StatusPill";
import Avatar from "../../components/ui/Avatar";
import EmployeeFormModal from "../../components/employees/EmployeeFormModal";
import PermissionLine from "../../components/employees/PermissionLine";
import { formatDui } from "../../lib/dui";
import { IconEdit, IconPlus } from "../../lib/icons";

const fullName = (e) => `${e.name || ""} ${e.lastName || ""}`.trim();

const STATUS_FILTERS = {
  all: () => true,
  active: (e) => e.isActive !== false,
  inactive: (e) => e.isActive === false,
};

/*
  Configuración > Personal y permisos: registro completo de empleados
  (activos e inactivos), con alta y edición. Cada fila muestra a qué paneles
  tendría acceso según su área y puesto (informativo, ver lib/permissions.js).
*/
function PersonalPermisos({ employees, loading, error, refetch }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  // null = cerrado; { employee: null } = nuevo; { employee } = editar.
  const [editing, setEditing] = useState(null);

  // Puestos ya usados, para sugerirlos al escribir (el puesto es texto libre).
  const positions = useMemo(
    () => [...new Set(employees.map((e) => e.position?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [employees],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter(STATUS_FILTERS[status])
      .filter((e) => !q || [fullName(e), e.position, e.department, e.email, e.dui].some((v) => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false) || fullName(a).localeCompare(fullName(b), "es"));
  }, [employees, query, status]);

  const activeCount = employees.filter(STATUS_FILTERS.active).length;

  let body;
  if (loading && !employees.length) body = <EmptyState title="Cargando empleados…" />;
  else if (error) body = <EmptyState title="No se pudo cargar el personal" description={error} />;
  else if (!visible.length) body = <EmptyState title={employees.length ? "Ningún empleado coincide." : "No hay empleados registrados."} />;
  else
    body = visible.map((e) => {
      const detail = [e.position, e.department, e.dui ? `DUI ${formatDui(e.dui)}` : null, e.email].filter(Boolean).join(" · ");
      return (
        <div key={e._id} className={`flex items-center gap-3.5 border-b border-line-soft px-5 py-3 last:border-b-0 ${e.isActive === false ? "bg-surface-2" : ""}`}>
          <Avatar person={e} size={36} tone="color" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`truncate text-[13.5px] font-semibold ${e.isActive === false ? "text-muted" : "text-ink"}`}>{fullName(e)}</span>
              <StatusPill status={e.isActive !== false ? "Activo" : "Inactivo"} domain="empleado" variant="dot" />
            </div>
            <p className="t-aux mt-0.5 truncate tabular-nums">{detail}</p>
            <div className="mt-1.5">
              <PermissionLine employee={e} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ employee: e })}
            aria-label={`Editar a ${fullName(e)}`}
            title="Editar"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <IconEdit width={14} height={14} />
          </button>
        </div>
      );
    });

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3.5 pt-4">
        <div className="min-w-0">
          <h2 className="t-card-title">Personal y permisos</h2>
          <p className="t-aux mt-0.5">
            Registro completo de empleados. Los permisos son informativos: se calculan con el área y el puesto, y todavía no restringen el acceso.
          </p>
        </div>
        <Button size="detail" icon={IconPlus} onClick={() => setEditing({ employee: null })}>
          Agregar empleado
        </Button>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line-soft px-5 py-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, puesto, área, DUI o correo" />
        <FilterChips
          value={status}
          onChange={setStatus}
          options={[
            { key: "all", label: "Todos", count: employees.length },
            { key: "active", label: "Activos", count: activeCount, tone: "green" },
            { key: "inactive", label: "Inactivos", count: employees.length - activeCount, tone: "gray" },
          ]}
        />
      </div>
      <div className="border-t border-line-soft">{body}</div>

      {editing ? (
        <EmployeeFormModal
          key={editing.employee?._id || "new"}
          employee={editing.employee}
          positions={positions}
          onClose={() => setEditing(null)}
          onSaved={refetch}
          onDeleted={refetch}
        />
      ) : null}
    </section>
  );
}

export default PersonalPermisos;
