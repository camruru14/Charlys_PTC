import { useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import FilterChips from "../../components/ui/FilterChips";
import SearchInput from "../../components/ui/SearchInput";
import StatusPill from "../../components/ui/StatusPill";
import Avatar from "../../components/ui/Avatar";
import EmployeeFormModal from "../../components/employees/EmployeeFormModal";
import PermissionLine from "../../components/employees/PermissionLine";
import { formatDui } from "../../lib/dui";
import { IconEdit, IconPlus } from "../../lib/icons";
import { ListCard, RowAction } from "./SettingsList";

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

  const renderRow = (e) => {
    const detail = [e.position, e.department, e.dui ? `DUI ${formatDui(e.dui)}` : null, e.email].filter(Boolean).join(" · ");
    return (
      <div
        key={e._id}
        className={`flex h-[92px] items-center gap-3.5 border-b border-line-soft px-5 ${e.isActive === false ? "bg-surface-2" : ""}`}
      >
        <Avatar person={e} size={36} tone="color" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-[13.5px] font-semibold ${e.isActive === false ? "text-muted" : "text-ink"}`}>{fullName(e)}</span>
            <StatusPill status={e.isActive !== false ? "Activo" : "Inactivo"} domain="empleado" variant="dot" />
          </div>
          <p className="t-aux mt-0.5 truncate tabular-nums">{detail}</p>
          <div className="mt-1.5 truncate">
            <PermissionLine employee={e} />
          </div>
        </div>
        <RowAction icon={IconEdit} label={`Editar a ${fullName(e)}`} onClick={() => setEditing({ employee: e })} />
      </div>
    );
  };

  return (
    <>
      <ListCard
        title="Personal y permisos"
        subtitle="Registro completo de empleados. Los permisos son informativos: se calculan con el área y el puesto, y todavía no restringen el acceso."
        action={
          <Button size="detail" icon={IconPlus} onClick={() => setEditing({ employee: null })}>
            Agregar empleado
          </Button>
        }
        toolbar={
          <>
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
          </>
        }
        items={visible}
        renderRow={renderRow}
        rowHeight={92}
        loading={loading}
        error={error}
        emptyText={employees.length ? "Ningún empleado coincide." : "No hay empleados registrados."}
        noun="empleados"
        resetKey={`${query}|${status}`}
      />

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
    </>
  );
}

export default PersonalPermisos;
