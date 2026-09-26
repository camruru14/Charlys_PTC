import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import ConfirmModal from "../components/ui/ConfirmModal";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import ActionsMenu from "../components/ui/ActionsMenu";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";
import { Field } from "../components/ui/Field";
import { SectionCard } from "../components/ui/SectionCard";
import { IconEdit, IconPlus } from "../lib/icons";
import { fmtNumber } from "../lib/format";

// Datos de la empresa: todavía no hay un modelo/endpoint dedicado en el
// backend para esto, así que se guardan localmente en el navegador. El
// horario laboral sí vive en el backend (/settings/work-schedule), porque de
// él depende el cálculo de «Tarde» y de horas extra en Empleados.
const COMPANY_STORAGE_KEY = "charly:company-info";
const COMPANY_FIELDS = ["name", "email", "phone", "address"];
const emptyCompany = { name: "Industrias Charly", email: "", phone: "", address: "" };

function loadCompany() {
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    return raw ? { ...emptyCompany, ...JSON.parse(raw) } : emptyCompany;
  } catch {
    return emptyCompany;
  }
}

const SECTIONS = ["empresa", "bodegas", "vehiculos"];

const inputClass =
  "h-[34px] w-full rounded-[9px] border border-line bg-surface px-3 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft";

function LogoTile({ size = 44 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[12px] bg-primary font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      IC
    </span>
  );
}

function SectionMenu({ value, onChange, counts }) {
  const items = [
    { key: "empresa", label: "Empresa" },
    { key: "bodegas", label: "Bodegas", count: counts.bodegas },
    { key: "vehiculos", label: "Vehículos", count: counts.vehiculos },
  ];
  return (
    <nav className="rounded-[14px] border border-line bg-surface p-2">
      <p className="t-label px-3 pb-1.5 pt-2">Secciones</p>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={active || undefined}
            onClick={() => onChange(item.key)}
            className={`flex h-9 w-full items-center justify-between rounded-[9px] px-3 text-[13px] font-semibold transition ${
              active ? "bg-primary-soft text-primary-soft-text" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {item.label}
            {item.count != null ? <span className="text-[12px] tabular-nums">{fmtNumber(item.count)}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

/*
  Lista con edición en línea: cada fila se edita en su lugar y la última fila
  agrega un elemento nuevo.
    items: [{ id, label, meta, blocked }]  (blocked: motivo por el que no se puede eliminar)
*/
function InlineList({ items, loading, error, emptyText, addPlaceholder, onAdd, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(item) {
    const value = draft.trim();
    if (!value) return toast.error("El campo no puede quedar vacío");
    if (value === item.label) return setEditingId(null);
    if (await run(() => onRename(item, value))) setEditingId(null);
  }

  async function add(e) {
    e.preventDefault();
    const value = newValue.trim();
    if (!value) return;
    if (await run(() => onAdd(value))) setNewValue("");
  }

  const row = "flex min-h-[52px] items-center gap-3 border-b border-line-soft px-5 py-2";

  let body;
  if (loading) body = <EmptyState title="Cargando…" />;
  else if (error) body = <EmptyState title="No se pudo cargar la lista" description={error} />;
  else if (!items.length) body = <EmptyState title={emptyText} />;
  else
    body = items.map((item) =>
      editingId === item.id ? (
        <div key={item.id} className={`${row} bg-select-bg`}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(item);
              if (e.key === "Escape") setEditingId(null);
            }}
            className={`${inputClass} max-w-[320px]`}
          />
          <Button size="row" disabled={busy} onClick={() => saveEdit(item)}>
            Guardar
          </Button>
          <Button variant="secondary" size="row" onClick={() => setEditingId(null)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div key={item.id} className={row}>
          <span className="t-row-name min-w-0 flex-1 truncate">{item.label}</span>
          {item.meta}
          <button
            type="button"
            onClick={() => {
              setEditingId(item.id);
              setDraft(item.label);
            }}
            aria-label={`Editar ${item.label}`}
            title="Editar"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <IconEdit width={15} height={15} />
          </button>
          <ActionsMenu
            size="row"
            items={[{ label: "Eliminar", danger: true, disabled: Boolean(item.blocked), hint: item.blocked, onClick: () => onDelete(item) }]}
          />
        </div>
      ),
    );

  return (
    <div className="-mx-5 border-t border-line-soft">
      {body}
      <form onSubmit={add} className="flex items-center gap-3 px-5 pt-3">
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={addPlaceholder} className={`${inputClass} max-w-[320px]`} />
        <Button type="submit" variant="soft" size="row" icon={IconPlus} disabled={busy || !newValue.trim()}>
          Agregar
        </Button>
      </form>
    </div>
  );
}

function Configuracion() {
  const { confirm, confirmProps } = useConfirm();
  const [section, setSection] = useUrlState("tab", "empresa", { allowed: SECTIONS });

  const { data: warehousesData, loading: warehousesLoading, error: warehousesError, refetch: refetchWarehouses } = useFetch("/warehouses");
  const { data: vehiclesData, loading: vehiclesLoading, error: vehiclesError, refetch: refetchVehicles } = useFetch("/vehicles");
  const { data: inventoryData, refetch: refetchInventory } = useFetch("/inventory");
  const { data: availability, refetch: refetchAvailability } = useFetch("/routes/availability");
  const { schedule, loading: scheduleLoading, refetch: refetchSchedule } = useWorkSchedule();

  const warehouses = useMemo(() => (Array.isArray(warehousesData) ? warehousesData : []), [warehousesData]);
  const vehicles = useMemo(() => (Array.isArray(vehiclesData) ? vehiclesData : []), [vehiclesData]);

  // Empresa: lo guardado y el borrador (null = sin cambios).
  const [savedCompany, setSavedCompany] = useState(loadCompany);
  const [companyDraft, setCompanyDraft] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const company = companyDraft ?? savedCompany;
  const scheduleForm = scheduleDraft ?? { startTime: schedule.startTime, workdayHours: String(schedule.workdayHours) };

  const companyDirty = Boolean(companyDraft) && COMPANY_FIELDS.some((k) => (companyDraft[k] || "") !== (savedCompany[k] || ""));
  const scheduleDirty =
    Boolean(scheduleDraft) &&
    (scheduleDraft.startTime !== schedule.startTime || Number(scheduleDraft.workdayHours) !== schedule.workdayHours);
  const dirty = companyDirty || scheduleDirty;

  const companyDetail = [savedCompany.email, savedCompany.phone, savedCompany.address].filter(Boolean).join(" · ");

  // Existencia por bodega (artículos con stock en esa ubicación).
  const stockByWarehouse = useMemo(() => {
    const map = new Map();
    (Array.isArray(inventoryData) ? inventoryData : []).forEach((i) => {
      if (i.location && i.stock > 0) map.set(i.location, (map.get(i.location) || 0) + 1);
    });
    return map;
  }, [inventoryData]);

  const vehicleRoutes = useMemo(
    () => new Map((availability?.vehicles || []).filter((v) => v.busy).map((v) => [String(v._id), v.route])),
    [availability],
  );

  function handleCompanyChange(e) {
    setCompanyDraft({ ...company, [e.target.name]: e.target.value });
  }

  function handleScheduleChange(e) {
    setScheduleDraft({ ...scheduleForm, [e.target.name]: e.target.value });
  }

  function discard() {
    setCompanyDraft(null);
    setScheduleDraft(null);
  }

  // La barra «Cambios sin guardar» sigue visible en las otras secciones, donde
  // el formulario no está montado: por eso se valida también aquí.
  async function handleSave(e) {
    e?.preventDefault();
    if (!dirty) return;
    const form = document.getElementById("company-form");
    if (form && !form.reportValidity()) return;
    if (!company.name?.trim()) return toast.error("Escribe el nombre de la empresa");
    const hours = Number(scheduleForm.workdayHours);
    if (scheduleDirty && !(hours > 0 && hours <= 24)) return toast.error("Las horas de jornada deben ser mayores que 0 y hasta 24");

    setSaving(true);
    try {
      if (scheduleDirty) {
        await api.put("/settings/work-schedule", { startTime: scheduleForm.startTime, workdayHours: hours });
        await refetchSchedule();
      }
      if (companyDirty) {
        localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
        setSavedCompany(company);
      }
      discard();
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Bodegas
  async function addWarehouse(name) {
    await api.post("/warehouses", { name });
    toast.success("Bodega agregada");
    refetchWarehouses();
    return true;
  }
  async function renameWarehouse(item, name) {
    await api.put(`/warehouses/${item.id}`, { name });
    toast.success("Bodega actualizada");
    refetchWarehouses();
    return true;
  }
  async function deleteWarehouse(item) {
    if (!(await confirm(`¿Eliminar la bodega «${item.label}»? Ya no se podrá elegir para enviar lotes ni verificar pedidos.`, { danger: true }))) return;
    try {
      await api.del(`/warehouses/${item.id}`);
      toast.success("Bodega eliminada");
    } catch (err) {
      toast.error(err.message);
    } finally {
      refetchWarehouses();
      refetchInventory();
    }
  }

  // Vehículos
  async function addVehicle(plate) {
    await api.post("/vehicles", { plate });
    toast.success("Vehículo agregado");
    refetchVehicles();
    refetchAvailability();
    return true;
  }
  async function renameVehicle(item, plate) {
    await api.put(`/vehicles/${item.id}`, { plate });
    toast.success("Vehículo actualizado");
    refetchVehicles();
    refetchAvailability();
    return true;
  }
  async function deleteVehicle(item) {
    if (!(await confirm(`¿Eliminar el vehículo «${item.label}»? Ya no se podrá elegir al armar rutas.`, { danger: true }))) return;
    try {
      await api.del(`/vehicles/${item.id}`);
      toast.success("Vehículo eliminado");
    } catch (err) {
      toast.error(err.message);
    } finally {
      refetchVehicles();
      refetchAvailability();
    }
  }

  const warehouseItems = warehouses.map((w) => {
    const withStock = stockByWarehouse.get(w.name) || 0;
    return {
      id: w._id,
      label: w.name,
      blocked: withStock ? "No se puede eliminar: la bodega tiene existencia" : null,
      meta: withStock ? (
        <span className="t-aux shrink-0 tabular-nums">
          {fmtNumber(withStock)} {withStock === 1 ? "artículo con existencia" : "artículos con existencia"}
        </span>
      ) : null,
    };
  });

  const vehicleItems = vehicles.map((v) => {
    const route = vehicleRoutes.get(String(v._id));
    return {
      id: v._id,
      label: v.plate,
      blocked: route ? "No se puede eliminar: el vehículo está en ruta" : null,
      meta: (
        <span className="flex shrink-0 items-center gap-2">
          {route ? (
            <span className="t-aux tabular-nums">
              Ruta {route.number}
              {route.zone ? ` · ${route.zone}` : ""}
            </span>
          ) : null}
          <StatusPill status={route ? "En ruta" : "Disponible"} domain="vehiculo" />
        </span>
      ),
    };
  });

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Configuración"
        subtitle="Preferencias del sistema y de la cuenta"
        actions={
          dirty ? (
            <>
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-tone-amber-text">
                <span className="h-[7px] w-[7px] rounded-full bg-tone-amber-dot" />
                Cambios sin guardar
              </span>
              <Button variant="secondary" onClick={discard} disabled={saving}>
                Descartar
              </Button>
              <Button onClick={() => handleSave()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SectionMenu value={section} onChange={setSection} counts={{ bodegas: warehouses.length, vehiculos: vehicles.length }} />

        <div className="flex min-w-0 flex-col gap-3.5">
          <section className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-5 py-4">
            <LogoTile />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-ink">{savedCompany.name || "Industrias Charly"}</p>
              {companyDetail ? <p className="t-aux mt-0.5 truncate">{companyDetail}</p> : null}
            </div>
          </section>

          {section === "empresa" ? (
            <SectionCard title="Empresa" subtitle="Aparecen en las facturas, en los reportes y en la tienda en línea">
              <form id="company-form" onSubmit={handleSave} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Nombre de la empresa" name="name" value={company.name} onChange={handleCompanyChange} required />
                    <Field label="Correo" name="email" type="email" value={company.email} onChange={handleCompanyChange} />
                    <Field label="Teléfono" name="phone" value={company.phone} onChange={handleCompanyChange} />
                    <Field label="Dirección" name="address" value={company.address} onChange={handleCompanyChange} />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Logo</span>
                    <LogoTile size={72} />
                  </div>
                </div>

                <div className="border-t border-line-soft pt-4">
                  <h3 className="text-[13.5px] font-semibold text-ink">Horario laboral</h3>
                  <p className="t-aux mt-0.5">Se usa en Empleados para marcar las llegadas tarde y calcular las horas extra.</p>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Hora de entrada"
                      name="startTime"
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={handleScheduleChange}
                      disabled={scheduleLoading && !scheduleDraft}
                      required
                    />
                    <Field
                      label="Horas de jornada"
                      name="workdayHours"
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      value={scheduleForm.workdayHours}
                      onChange={handleScheduleChange}
                      disabled={scheduleLoading && !scheduleDraft}
                      required
                    />
                  </div>
                </div>
              </form>
            </SectionCard>
          ) : section === "bodegas" ? (
            <SectionCard title="Bodegas" subtitle="Destinos disponibles para enviar lotes y verificar pedidos">
              <InlineList
                items={warehouseItems}
                loading={warehousesLoading}
                error={warehousesError}
                emptyText="No hay bodegas registradas."
                addPlaceholder="Nombre de la nueva bodega"
                onAdd={addWarehouse}
                onRename={renameWarehouse}
                onDelete={deleteWarehouse}
              />
            </SectionCard>
          ) : (
            <SectionCard title="Vehículos" subtitle="Flota disponible para armar rutas">
              <InlineList
                items={vehicleItems}
                loading={vehiclesLoading}
                error={vehiclesError}
                emptyText="No hay vehículos registrados."
                addPlaceholder="Placa del nuevo vehículo"
                onAdd={addVehicle}
                onRename={renameVehicle}
                onDelete={deleteVehicle}
              />
            </SectionCard>
          )}
        </div>
      </div>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Configuracion;
