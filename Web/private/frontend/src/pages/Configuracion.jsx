import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import { useProductionLines } from "../hooks/useProductionLines";
import { useAuth } from "../hooks/useAuth";
import LineasProduccion from "./configuracion/LineasProduccion";
import PersonalPermisos from "./configuracion/PersonalPermisos";
import MiCuenta from "./configuracion/MiCuenta";
import { formatDui, maskDui } from "../lib/dui";
import ConfirmModal from "../components/ui/ConfirmModal";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";
import { Field } from "../components/ui/Field";
import { buttonClass } from "../lib/buttonStyles";
import {
  IconAlert,
  IconBox,
  IconBuilding,
  IconCheck,
  IconEdit,
  IconFactory,
  IconPlus,
  IconTruck,
  IconUser,
  IconUsers,
} from "../lib/icons";
import { fmtNumber, fmtElapsed, fmtRelativeDay } from "../lib/format";
import { personName } from "../lib/logistics";

// Datos de la empresa: viven en el backend (/settings/company, compartidos
// por todos los usuarios), igual que el horario laboral
// (/settings/work-schedule), del que depende el cálculo de «Tarde» y de horas
// extra en Empleados. Antes la ficha se guardaba solo en el localStorage del
// navegador: si el backend todavía no tiene ficha y el navegador sí, esos
// datos se proponen como «Cambios sin guardar» para subirlos con un clic.
const LEGACY_COMPANY_KEY = "charly:company-info";
const COMPANY_FIELDS = ["name", "nit", "email", "phone", "address"];
const DEFAULT_COMPANY = { name: "Industrias Charly", nit: "", email: "", phone: "", address: "", currency: "USD", logoUrl: null, updatedAt: null };
// El sistema solo maneja dólares: la moneda se muestra pero no se edita.
const CURRENCY_LABELS = { USD: "USD — dólar estadounidense" };
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function loadLegacyCompany() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_COMPANY_KEY) || "null");
    if (!parsed) return null;
    const picked = Object.fromEntries(COMPANY_FIELDS.map((k) => [k, typeof parsed[k] === "string" ? parsed[k] : ""]));
    return COMPANY_FIELDS.some((k) => picked[k]) ? picked : null;
  } catch {
    return null;
  }
}

function clearLegacyCompany() {
  try {
    localStorage.removeItem(LEGACY_COMPANY_KEY);
  } catch {
    // Sin acceso al almacenamiento: no hay nada que limpiar.
  }
}

// ?tab= de cada sección del menú. «usuarios» (el nombre anterior de Personal
// y permisos) cae en Empresa.
const SECTIONS = ["empresa", "bodegas", "vehiculos", "lineas", "personal", "cuenta"];

const emptyAccountForm = { phone: "", dui: "" };

// Abreviatura de cada unidad de inventario en el resumen de una bodega.
const UNIT_ABBR = { unidad: "u", unidades: "u" };

function LogoTile({ size = 40, url }) {
  if (url) {
    return (
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-surface"
        style={{ width: size, height: size }}
      >
        <img src={url} alt="Logo de la empresa" className="h-full w-full object-contain" />
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-primary font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      IC
    </span>
  );
}

// Reloj que avanza cada minuto, para los textos «hace X min».
function useNow(interval = 60000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

// «hace 5 min» / «hace 3 h» dentro del mismo día; después, «ayer» o «el 19 sep».
function fmtSince(value, now) {
  const time = new Date(value).getTime();
  if (now - time < 86400000) return fmtElapsed(value, now);
  const day = fmtRelativeDay(value);
  return day === "ayer" ? day : `el ${day}`;
}

/*
  Menú de secciones (columna izquierda, alto completo) con la tarjeta de
  estado al pie: empresa, versión del panel y la última vez que se guardó la
  ficha de la empresa.
*/
function SectionMenu({ value, onChange, counts, companyName, updatedAt }) {
  const now = useNow();
  const items = [
    { key: "empresa", label: "Empresa", icon: IconBuilding },
    { key: "bodegas", label: "Bodegas", icon: IconBox, count: counts.bodegas },
    { key: "vehiculos", label: "Vehículos", icon: IconTruck, count: counts.vehiculos },
    { key: "lineas", label: "Líneas de producción", icon: IconFactory, count: counts.lineas },
    { key: "personal", label: "Personal y permisos", icon: IconUsers, count: counts.personal },
    { key: "cuenta", label: "Mi cuenta", icon: IconUser },
  ];
  return (
    <nav className="flex h-full flex-col rounded-[14px] border border-line bg-surface p-3" aria-label="Secciones">
      <p className="t-label px-2.5 pb-2 pt-1.5">Secciones</p>
      <div className="flex flex-col gap-0.5">
        {items.map(({ key, label, icon: Icon, count }) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              aria-current={active || undefined}
              onClick={() => onChange(key)}
              className={`flex h-[38px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] transition ${
                active ? "bg-primary-soft font-semibold text-primary-soft-text" : "font-medium text-ink-2 hover:bg-surface-2"
              }`}
            >
              <Icon width={16} height={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {count != null ? <span className="text-[12px] tabular-nums text-muted">{fmtNumber(count)}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-[10px] border border-line-soft bg-surface-2 px-3 py-2.5 lg:mt-auto">
        <p className="truncate text-[12.5px] font-bold text-ink">{companyName}</p>
        <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted">
          Panel administrativo v{__APP_VERSION__}
          {updatedAt ? ` · cambios guardados ${fmtSince(updatedAt, now)}` : ""}
        </p>
      </div>
    </nav>
  );
}

// Tarjeta con encabezado (título, subtítulo, acción) y filas separadas por
// líneas, para Bodegas y Vehículos.
function ListCard({ title, subtitle, onAdd, loading, error, emptyText, children }) {
  let body = children;
  if (loading) body = <EmptyState title="Cargando…" />;
  else if (error) body = <EmptyState title="No se pudo cargar la lista" description={error} />;
  else if (!children.length) body = <EmptyState title={emptyText} />;
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 px-5 pb-3.5 pt-4">
        <div className="min-w-0">
          <h2 className="t-card-title">{title}</h2>
          <p className="t-aux mt-0.5">{subtitle}</p>
        </div>
        <Button variant="soft" size="detail" icon={IconPlus} onClick={onAdd}>
          Agregar
        </Button>
      </div>
      <div className="flex-1 border-t border-line-soft">{body}</div>
    </section>
  );
}

const rowClass = "flex min-h-[58px] w-full items-center gap-3 border-b border-line-soft px-5 py-2.5 text-left last:border-b-0";

function RowIcon({ icon: Icon }) {
  return (
    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-line-soft bg-surface-2 text-muted">
      <Icon width={16} height={16} />
    </span>
  );
}

function RowText({ title, detail }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-semibold text-ink">{title}</span>
      <span className="t-aux block truncate tabular-nums">{detail}</span>
    </span>
  );
}

/*
  Modal para agregar o editar una bodega o un vehículo (un solo campo: nombre
  o placa). En edición también permite eliminar; `blocked` es el motivo por
  el que no se puede (bodega con existencia, vehículo en ruta).
*/
function EntityModal({ state, onClose, onSubmit, onDelete }) {
  const [value, setValue] = useState(state?.item?.label || "");
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const { kind, item } = state;
  const isWarehouse = kind === "warehouse";
  const noun = isWarehouse ? "bodega" : "vehículo";

  async function submit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return toast.error(isWarehouse ? "Escribe el nombre de la bodega" : "Escribe la placa del vehículo");
    if (item && trimmed === item.label) return onClose();
    setBusy(true);
    try {
      await onSubmit(kind, item, trimmed);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? `Editar ${noun}` : isWarehouse ? "Nueva bodega" : "Nuevo vehículo"}
      footer={
        <>
          {item ? (
            <button
              type="button"
              onClick={() => onDelete(kind, item)}
              disabled={Boolean(item.blocked)}
              title={item.blocked || undefined}
              className={`${buttonClass("danger", "modal")} mr-auto disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Eliminar
            </button>
          ) : null}
          <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>
            Cancelar
          </button>
          <button type="submit" form="entity-form" disabled={busy} className={buttonClass("primary", "modal")}>
            {busy ? "Guardando…" : item ? "Guardar" : "Agregar"}
          </button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit} className="flex flex-col gap-2">
        <Field
          label={isWarehouse ? "Nombre de la bodega" : "Placa"}
          name="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isWarehouse ? "Ej. Bodega Central" : "Ej. P123-456"}
          autoFocus
          required
        />
        {item?.blocked ? <p className="t-aux">{item.blocked}.</p> : null}
      </form>
    </Modal>
  );
}

function Configuracion() {
  const { confirm, confirmProps } = useConfirm();
  const [section, setSection] = useUrlState("tab", "empresa", { allowed: SECTIONS });

  const { data: companyData, error: companyError, mutate: mutateCompany } = useFetch("/settings/company");
  const { data: warehousesData, loading: warehousesLoading, error: warehousesError, refetch: refetchWarehouses } = useFetch("/warehouses");
  const { data: vehiclesData, loading: vehiclesLoading, error: vehiclesError, refetch: refetchVehicles } = useFetch("/vehicles");
  const { data: inventoryData, refetch: refetchInventory } = useFetch("/inventory");
  const { data: availability, refetch: refetchAvailability } = useFetch("/routes/availability");
  const { data: routesData } = useFetch("/routes");
  const { schedule, loading: scheduleLoading, refetch: refetchSchedule } = useWorkSchedule();
  const { lines, loading: linesLoading, error: linesError, refetch: refetchLines } = useProductionLines();
  const { data: employeesData, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useFetch("/employees");
  const { data: account, loading: accountLoading, error: accountError, mutate: mutateAccount } = useFetch("/auth/me");
  const { updateUser } = useAuth();

  const warehouses = useMemo(() => (Array.isArray(warehousesData) ? warehousesData : []), [warehousesData]);
  const vehicles = useMemo(() => (Array.isArray(vehiclesData) ? vehiclesData : []), [vehiclesData]);
  const employees = useMemo(() => (Array.isArray(employeesData) ? employeesData : []), [employeesData]);

  // Empresa: lo guardado y el borrador (null = sin cambios).
  const [legacyCompany, setLegacyCompany] = useState(loadLegacyCompany);
  const [companyDraft, setCompanyDraft] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  // Mi cuenta: borrador de teléfono y DUI (correo y contraseña van aparte, con la contraseña actual).
  const [accountDraft, setAccountDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Modal de bodega/vehículo: { kind: "warehouse" | "vehicle", item? } (sin item = agregar).
  const [entityModal, setEntityModal] = useState(null);
  const logoInputRef = useRef(null);

  const companyReady = Boolean(companyData);
  const savedCompany = useMemo(() => ({ ...DEFAULT_COMPANY, ...(companyData || {}) }), [companyData]);
  // Ficha nunca guardada en el backend + datos viejos del navegador.
  const pendingLegacy = companyReady && !companyData.updatedAt ? legacyCompany : null;
  const company = companyDraft ?? (pendingLegacy ? { ...savedCompany, ...pendingLegacy } : savedCompany);
  const scheduleForm = scheduleDraft ?? { startTime: schedule.startTime, workdayHours: String(schedule.workdayHours) };

  const companyDirty = companyReady && COMPANY_FIELDS.some((k) => (company[k] || "") !== (savedCompany[k] || ""));
  const scheduleDirty =
    Boolean(scheduleDraft) &&
    (scheduleDraft.startTime !== schedule.startTime || Number(scheduleDraft.workdayHours) !== schedule.workdayHours);
  const savedAccountForm = account ? { phone: account.phone || "", dui: formatDui(account.dui) } : emptyAccountForm;
  const accountForm = accountDraft ?? savedAccountForm;
  const accountDirty =
    Boolean(account && accountDraft) && (accountDraft.phone.trim() !== savedAccountForm.phone || accountDraft.dui !== savedAccountForm.dui);
  const dirty = companyDirty || scheduleDirty || accountDirty;

  // Existencia por bodega: artículos con stock en esa ubicación y total por
  // unidad («34 artículos · 41,200 u · 350 kg»).
  const stockByWarehouse = useMemo(() => {
    const map = new Map();
    (Array.isArray(inventoryData) ? inventoryData : []).forEach((i) => {
      if (!i.location || !(i.stock > 0)) return;
      const entry = map.get(i.location) || { items: 0, units: new Map() };
      entry.items += 1;
      const unit = UNIT_ABBR[i.unit] || i.unit || "u";
      entry.units.set(unit, (entry.units.get(unit) || 0) + Number(i.stock));
      map.set(i.location, entry);
    });
    return map;
  }, [inventoryData]);

  const vehicleRoutes = useMemo(
    () => new Map((availability?.vehicles || []).filter((v) => v.busy).map((v) => [String(v._id), v.route])),
    [availability],
  );

  // Motorista de cada ruta de hoy (availability solo trae número y zona).
  const routeDrivers = useMemo(
    () => new Map((Array.isArray(routesData) ? routesData : []).map((r) => [String(r._id), personName(r.driver)])),
    [routesData],
  );

  function handleCompanyChange(e) {
    setCompanyDraft({ ...company, [e.target.name]: e.target.value });
  }

  function handleScheduleChange(e) {
    setScheduleDraft({ ...scheduleForm, [e.target.name]: e.target.value });
  }

  function handleAccountChange(e) {
    const { name, value } = e.target;
    setAccountDraft({ ...accountForm, [name]: name === "dui" ? maskDui(value) : value });
  }

  // Correo o contraseña cambiados en Mi cuenta: se actualiza la cuenta y el
  // usuario en sesión (el correo aparece en el pie del menú lateral).
  function handleCredentialsSaved(saved) {
    mutateAccount(saved);
    updateUser({ email: saved.email });
  }

  function discard() {
    setCompanyDraft(null);
    setScheduleDraft(null);
    setAccountDraft(null);
    // Descartar también descarta los datos viejos del navegador.
    if (pendingLegacy) {
      clearLegacyCompany();
      setLegacyCompany(null);
    }
  }

  // La barra «Cambios sin guardar» sigue visible en las otras secciones,
  // donde el formulario no está montado: por eso se valida también aquí.
  async function handleSave(e) {
    e?.preventDefault();
    if (!dirty) return;
    for (const id of ["company-form", "account-form"]) {
      const form = document.getElementById(id);
      if (form && !form.reportValidity()) return;
    }
    if (!company.name?.trim()) return toast.error("Escribe el nombre de la empresa");
    const hours = Number(scheduleForm.workdayHours);
    if (scheduleDirty && !(hours > 0 && hours <= 24)) return toast.error("Las horas de jornada deben ser mayores que 0 y hasta 24");
    if (accountDirty && accountForm.dui && !/^\d{8}-\d$/.test(accountForm.dui)) return toast.error("El DUI debe tener 9 números (ej. 12345678-9)");

    setSaving(true);
    try {
      if (accountDirty) {
        mutateAccount(await api.put("/auth/me", { phone: accountForm.phone.trim(), dui: accountForm.dui }));
        setAccountDraft(null);
      }
      if (scheduleDirty) {
        await api.put("/settings/work-schedule", { startTime: scheduleForm.startTime, workdayHours: hours });
        await refetchSchedule();
      }
      if (companyDirty) {
        const saved = await api.put("/settings/company", Object.fromEntries(COMPANY_FIELDS.map((k) => [k, company[k] || ""])));
        mutateCompany(saved);
        clearLegacyCompany();
        setLegacyCompany(null);
      }
      setCompanyDraft(null);
      setScheduleDraft(null);
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // El logo se sube y se guarda en el momento (como las fotos del Catálogo),
  // sin pasar por «Guardar cambios».
  async function handleLogoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("El logo debe ser una imagen");
    if (file.size > MAX_LOGO_BYTES) return toast.error("La imagen no puede pesar más de 5 MB");

    // Subir el logo crea la ficha en el backend: si había datos viejos del
    // navegador pendientes, pasan al borrador para no perderlos.
    if (pendingLegacy && !companyDraft) setCompanyDraft(company);

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      mutateCompany(await api.post("/settings/company/logo", formData));
      toast.success("Logo actualizado");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingLogo(false);
    }
  }

  // Bodegas y vehículos: agregar o renombrar desde el modal.
  async function saveEntity(kind, item, value) {
    if (kind === "warehouse") {
      if (item) await api.put(`/warehouses/${item.id}`, { name: value });
      else await api.post("/warehouses", { name: value });
      toast.success(item ? "Bodega actualizada" : "Bodega agregada");
      refetchWarehouses();
      return;
    }
    if (item) await api.put(`/vehicles/${item.id}`, { plate: value });
    else await api.post("/vehicles", { plate: value });
    toast.success(item ? "Vehículo actualizado" : "Vehículo agregado");
    refetchVehicles();
    refetchAvailability();
  }

  async function deleteEntity(kind, item) {
    setEntityModal(null);
    const isWarehouse = kind === "warehouse";
    const message = isWarehouse
      ? `¿Eliminar la bodega «${item.label}»? Ya no se podrá elegir para enviar lotes ni verificar pedidos.`
      : `¿Eliminar el vehículo «${item.label}»? Ya no se podrá elegir al armar rutas.`;
    if (!(await confirm(message, { danger: true }))) return;
    try {
      await api.del(`/${isWarehouse ? "warehouses" : "vehicles"}/${item.id}`);
      toast.success(isWarehouse ? "Bodega eliminada" : "Vehículo eliminado");
    } catch (err) {
      toast.error(err.message);
    } finally {
      if (isWarehouse) {
        refetchWarehouses();
        refetchInventory();
      } else {
        refetchVehicles();
        refetchAvailability();
      }
    }
  }

  const warehouseRows = warehouses.map((w) => {
    const stock = stockByWarehouse.get(w.name);
    const item = { id: w._id, label: w.name, blocked: stock ? "No se puede eliminar: la bodega tiene existencia" : null };
    const detail = stock
      ? [
          `${fmtNumber(stock.items)} ${stock.items === 1 ? "artículo" : "artículos"}`,
          ...[...stock.units].map(([unit, total]) => `${fmtNumber(total)} ${unit}`),
        ].join(" · ")
      : "Sin existencia";
    return (
      <div key={w._id} className={rowClass}>
        <RowIcon icon={IconBox} />
        <RowText title={w.name} detail={detail} />
        <button
          type="button"
          onClick={() => setEntityModal({ kind: "warehouse", item })}
          aria-label={`Editar ${w.name}`}
          title="Editar"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          <IconEdit width={14} height={14} />
        </button>
      </div>
    );
  });

  // Cada fila de vehículo abre su modal de edición al hacer clic.
  const vehicleRows = vehicles.map((v) => {
    const route = vehicleRoutes.get(String(v._id));
    const driver = route ? routeDrivers.get(String(route._id)) : null;
    const item = { id: v._id, label: v.plate, blocked: route ? "No se puede eliminar: el vehículo está en ruta" : null };
    const detail = route ? [`Ruta ${route.number}${route.zone ? ` · ${route.zone}` : ""}`, driver || "sin conductor"].join(" · ") : "sin asignar";
    return (
      <button
        key={v._id}
        type="button"
        onClick={() => setEntityModal({ kind: "vehicle", item })}
        title="Editar vehículo"
        className={`${rowClass} transition hover:bg-surface-2`}
      >
        <RowIcon icon={IconTruck} />
        <RowText title={v.plate} detail={detail} />
        <StatusPill status={route ? "En ruta" : "Disponible"} domain="vehiculo" />
      </button>
    );
  });

  const warehousesCard = (
    <ListCard
      title="Bodegas"
      subtitle="Destinos disponibles al reportar inventario"
      onAdd={() => setEntityModal({ kind: "warehouse" })}
      loading={warehousesLoading}
      error={warehousesError}
      emptyText="No hay bodegas registradas."
    >
      {warehouseRows}
    </ListCard>
  );

  const vehiclesCard = (
    <ListCard
      title="Vehículos"
      subtitle="Flota disponible para armar rutas"
      onAdd={() => setEntityModal({ kind: "vehicle" })}
      loading={vehiclesLoading}
      error={vehiclesError}
      emptyText="No hay vehículos registrados."
    >
      {vehicleRows}
    </ListCard>
  );

  const fieldProps = { onChange: handleCompanyChange, disabled: !companyReady };

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Configuración"
        subtitle="Preferencias del sistema y de la cuenta"
        actions={
          dirty ? (
            <>
              <span className="inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-tone-amber-line bg-tone-amber px-3.5 text-[13px] font-semibold text-tone-amber-strong">
                <IconAlert width={15} height={15} />
                Cambios sin guardar
              </span>
              <Button variant="secondary" onClick={discard} disabled={saving}>
                Descartar
              </Button>
              <Button icon={IconCheck} onClick={() => handleSave()} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SectionMenu
          value={section}
          onChange={setSection}
          counts={{ bodegas: warehouses.length, vehiculos: vehicles.length, lineas: lines.length, personal: employees.length }}
          companyName={savedCompany.name || DEFAULT_COMPANY.name}
          updatedAt={savedCompany.updatedAt}
        />

        <div className="flex min-w-0 flex-col gap-3.5">
          {section === "empresa" ? (
              <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="t-card-title">Datos de la empresa</h2>
                    <p className="t-aux mt-0.5">Aparecen en las facturas, en los reportes y en la tienda en línea</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <LogoTile url={savedCompany.logoUrl} />
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                    <Button
                      variant="secondary"
                      size="detail"
                      disabled={uploadingLogo || !companyReady}
                      title="PNG o JPG, hasta 5 MB"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadingLogo ? "Subiendo…" : "Cambiar logo"}
                    </Button>
                  </div>
                </div>

                {companyError ? <p className="mb-4 text-[12.5px] font-medium text-tone-rose-text">No se pudo cargar la ficha de la empresa: {companyError}</p> : null}

                <form id="company-form" onSubmit={handleSave} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Field label="Nombre de la empresa" name="name" value={company.name} {...fieldProps} required />
                    </div>
                    <Field label="NIT" name="nit" value={company.nit} {...fieldProps} placeholder="0614-000000-000-0" />
                    <Field label="Teléfono" name="phone" value={company.phone} {...fieldProps} />
                    <Field label="Correo de contacto" name="email" type="email" value={company.email} {...fieldProps} />
                    <Field
                      label="Moneda"
                      name="currency"
                      value={CURRENCY_LABELS[savedCompany.currency] || savedCompany.currency}
                      readOnly
                      tabIndex={-1}
                      title="El sistema trabaja solo en dólares"
                      className="w-full cursor-default rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none"
                    />
                    <div className="sm:col-span-3">
                      <Field label="Dirección fiscal" name="address" value={company.address} {...fieldProps} />
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
              </section>
          ) : section === "bodegas" ? (
            warehousesCard
          ) : section === "vehiculos" ? (
            vehiclesCard
          ) : section === "lineas" ? (
            <LineasProduccion lines={lines} loading={linesLoading} error={linesError} refetch={refetchLines} />
          ) : section === "personal" ? (
            <PersonalPermisos employees={employees} loading={employeesLoading} error={employeesError} refetch={refetchEmployees} />
          ) : (
            <MiCuenta
              account={account}
              loading={accountLoading}
              error={accountError}
              form={accountForm}
              onChange={handleAccountChange}
              onCredentialsSaved={handleCredentialsSaved}
            />
          )}
        </div>
      </div>

      {entityModal ? (
        <EntityModal
          key={`${entityModal.kind}-${entityModal.item?.id || "new"}`}
          state={entityModal}
          onClose={() => setEntityModal(null)}
          onSubmit={saveEntity}
          onDelete={deleteEntity}
        />
      ) : null}
      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Configuracion;
