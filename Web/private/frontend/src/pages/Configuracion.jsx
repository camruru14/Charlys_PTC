import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import { useProductionLines } from "../hooks/useProductionLines";
import { useSubcategories } from "../hooks/useSubcategories";
import { useAuth } from "../hooks/useAuth";
import LineasProduccion from "./configuracion/LineasProduccion";
import Subcategorias from "./configuracion/Subcategorias";
import PersonalPermisos from "./configuracion/PersonalPermisos";
import MiCuenta from "./configuracion/MiCuenta";
import ConfirmPasswordModal from "./configuracion/ConfirmPasswordModal";
import { formatDui, maskDui } from "../lib/dui";
import ConfirmModal from "../components/ui/ConfirmModal";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import StatusPill from "../components/ui/StatusPill";
import { InlineName, ListCard, ListRow, RowAction, RowIcon, RowText } from "./configuracion/SettingsList";
import { useFillHeight } from "../hooks/useFillHeight";
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
  IconTag,
  IconTrash,
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
const SECTIONS = ["empresa", "bodegas", "vehiculos", "lineas", "subcategorias", "personal", "cuenta"];

// Mi cuenta: teléfono y DUI, más el cambio de correo o contraseña (que pide la actual).
const emptyAccountForm = { phone: "", dui: "", newEmail: "", newPassword: "" };
const MIN_PASSWORD_LENGTH = 6;

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
    { key: "subcategorias", label: "Subcategorías", icon: IconTag, count: counts.subcategorias },
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

/*
  Modal para agregar una bodega o un vehículo, o editar la placa de un
  vehículo (un solo campo). Eliminar se hace desde el ícono de la fila; el
  nombre de una bodega se edita en la misma fila (InlineName).
*/
function EntityModal({ state, onClose, onSubmit }) {
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
  const { subcategories, loading: subcategoriesLoading, error: subcategoriesError, refetch: refetchSubcategories } = useSubcategories();
  const { data: employeesData, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useFetch("/employees");
  const { data: account, loading: accountLoading, error: accountError, mutate: mutateAccount } = useFetch("/auth/me");
  // Contraseña propia desencriptada, para el ojo de Mi cuenta: { password, legacy }.
  const { data: myPassword, mutate: mutateMyPassword } = useFetch("/auth/me/password");
  const { updateUser, setSessionPassword } = useAuth();

  const warehouses = useMemo(() => (Array.isArray(warehousesData) ? warehousesData : []), [warehousesData]);
  const vehicles = useMemo(() => (Array.isArray(vehiclesData) ? vehiclesData : []), [vehiclesData]);
  const employees = useMemo(() => (Array.isArray(employeesData) ? employeesData : []), [employeesData]);

  // Empresa: lo guardado y el borrador (null = sin cambios).
  const [legacyCompany, setLegacyCompany] = useState(loadLegacyCompany);
  const [companyDraft, setCompanyDraft] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState(null);
  // Mi cuenta: borrador de teléfono y DUI (correo y contraseña van aparte, con la contraseña actual).
  const [accountDraft, setAccountDraft] = useState(null);
  // Modal que pide la contraseña actual al guardar un cambio de correo o contraseña: { value, error } | null.
  const [passwordPrompt, setPasswordPrompt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Modal de bodega/vehículo: { kind: "warehouse" | "vehicle", item? } (sin item = agregar).
  const [entityModal, setEntityModal] = useState(null);
  const logoInputRef = useRef(null);
  const layoutRef = useRef(null);
  const layoutHeight = useFillHeight(layoutRef);

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
  const savedAccountForm = account ? { ...emptyAccountForm, phone: account.phone || "", dui: formatDui(account.dui) } : emptyAccountForm;
  const accountForm = accountDraft ?? savedAccountForm;
  const profileDirty = Boolean(account) && (accountForm.phone.trim() !== savedAccountForm.phone || accountForm.dui !== savedAccountForm.dui);
  // Escribir en «Nuevo correo» o «Nueva contraseña» ya cuenta como cambio.
  const credentialsTouched = Boolean(accountForm.newEmail.trim() || accountForm.newPassword);
  const accountDirty = Boolean(account && accountDraft) && (profileDirty || credentialsTouched);
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

  // Valida el cambio de correo o contraseña de Mi cuenta antes de guardar.
  // Devuelve { email?, newPassword? } para /auth/me/credentials (la
  // contraseña actual se pide aparte, en ConfirmPasswordModal), null si no
  // hay cambio de acceso, o false si hay que corregir algo (ya avisado).
  function credentialsRequest() {
    if (!credentialsTouched) return null;
    const email = accountForm.newEmail.trim().toLowerCase();
    const wantsEmail = Boolean(email) && email !== account.email;
    const wantsPassword = Boolean(accountForm.newPassword);
    const focus = (name) => document.querySelector(`#account-form [name="${name}"]`)?.focus();

    if (email && !wantsEmail) {
      toast.error("El nuevo correo es igual al actual");
      focus("newEmail");
      return false;
    }
    if (!wantsEmail && !wantsPassword) {
      toast.error("Escribe el nuevo correo o la nueva contraseña, o descarta los cambios");
      focus("newEmail");
      return false;
    }
    if (wantsPassword && accountForm.newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      focus("newPassword");
      return false;
    }
    return {
      email: wantsEmail ? email : undefined,
      newPassword: wantsPassword ? accountForm.newPassword : undefined,
    };
  }

  function discard() {
    setCompanyDraft(null);
    setScheduleDraft(null);
    setAccountDraft(null);
    setPasswordPrompt(null);
    // Descartar también descarta los datos viejos del navegador.
    if (pendingLegacy) {
      clearLegacyCompany();
      setLegacyCompany(null);
    }
  }

  // La barra «Cambios sin guardar» sigue visible en las otras secciones,
  // donde el formulario no está montado: por eso se valida también aquí.
  // currentPassword: lo que se escribió en ConfirmPasswordModal (solo hace
  // falta si hay un cambio de correo o contraseña).
  async function handleSave(e, currentPassword) {
    e?.preventDefault?.();
    if (!dirty) return;
    for (const id of ["company-form", "account-form"]) {
      const form = document.getElementById(id);
      if (form && !form.reportValidity()) return;
    }
    if (!company.name?.trim()) return toast.error("Escribe el nombre de la empresa");
    const hours = Number(scheduleForm.workdayHours);
    if (scheduleDirty && !(hours > 0 && hours <= 24)) return toast.error("Las horas de jornada deben ser mayores que 0 y hasta 24");
    if (profileDirty && accountForm.dui && !/^\d{8}-\d$/.test(accountForm.dui)) return toast.error("El DUI debe tener 9 números (ej. 12345678-9)");
    const credentials = accountDirty ? credentialsRequest() : null;
    if (credentials === false) return;
    // Cambio de acceso: primero se pide la contraseña actual.
    if (credentials && !currentPassword) {
      setPasswordPrompt({ value: "", error: "" });
      return;
    }

    setSaving(true);
    try {
      // El cambio de acceso va primero: si la contraseña actual no es
      // correcta, falla aquí y no se guarda nada más.
      if (credentials) {
        let saved;
        try {
          saved = await api.put("/auth/me/credentials", { ...credentials, currentPassword });
        } catch (err) {
          // Contraseña incorrecta (u otro error): se avisa en el modal, que
          // sigue abierto para reintentar, y no se guarda nada más.
          setPasswordPrompt((p) => ({ value: p?.value ?? "", error: err.message }));
          return;
        }
        setPasswordPrompt(null);
        mutateAccount(saved);
        // El correo del usuario en sesión (pie del menú lateral).
        updateUser({ email: saved.email });
        // El ojo de «Contraseña actual» pasa a mostrar la nueva.
        if (credentials.newPassword) {
          setSessionPassword(credentials.newPassword);
          mutateMyPassword({ password: credentials.newPassword, legacy: false });
        }
        // Ya aplicado: si falla algo después, reintentar no lo repite.
        setAccountDraft((d) => (d ? { ...d, newEmail: "", newPassword: "" } : d));
      }
      if (profileDirty) {
        mutateAccount(await api.put("/auth/me", { phone: accountForm.phone.trim(), dui: accountForm.dui }));
      }
      setAccountDraft(null);
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

  // Bodegas y vehículos: agregar (modal), renombrar una bodega (en la fila)
  // o cambiar la placa de un vehículo (modal).
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

  // Bodegas: el nombre se edita en la misma fila (clic sobre el nombre) y
  // la fila solo tiene el ícono de eliminar.
  const renderWarehouse = (w) => {
    const stock = stockByWarehouse.get(w.name);
    const item = { id: w._id, label: w.name };
    const blocked = stock ? "No se puede eliminar: la bodega tiene existencia" : null;
    const detail = stock
      ? [
          `${fmtNumber(stock.items)} ${stock.items === 1 ? "artículo" : "artículos"}`,
          ...[...stock.units].map(([unit, total]) => `${fmtNumber(total)} ${unit}`),
        ].join(" · ")
      : "Sin existencia";
    return (
      <ListRow key={w._id}>
        <RowIcon icon={IconBox} />
        <InlineName value={w.name} detail={detail} label="nombre de la bodega" onSave={(name) => saveEntity("warehouse", item, name)} />
        <RowAction icon={IconTrash} label={`Eliminar ${w.name}`} danger disabled={Boolean(blocked)} reason={blocked} onClick={() => deleteEntity("warehouse", item)} />
      </ListRow>
    );
  };

  // Vehículos: editar (modal con la placa) y eliminar, cada uno con su ícono.
  const renderVehicle = (v) => {
    const route = vehicleRoutes.get(String(v._id));
    const driver = route ? routeDrivers.get(String(route._id)) : null;
    const item = { id: v._id, label: v.plate };
    const blocked = route ? "No se puede eliminar: el vehículo está en ruta" : null;
    const detail = route ? [`Ruta ${route.number}${route.zone ? ` · ${route.zone}` : ""}`, driver || "sin conductor"].join(" · ") : "sin asignar";
    return (
      <ListRow key={v._id}>
        <RowIcon icon={IconTruck} />
        <RowText title={v.plate} detail={detail} />
        <StatusPill status={route ? "En ruta" : "Disponible"} domain="vehiculo" />
        <RowAction icon={IconEdit} label={`Editar ${v.plate}`} onClick={() => setEntityModal({ kind: "vehicle", item })} />
        <RowAction icon={IconTrash} label={`Eliminar ${v.plate}`} danger disabled={Boolean(blocked)} reason={blocked} onClick={() => deleteEntity("vehicle", item)} />
      </ListRow>
    );
  };

  const addButton = (kind) => (
    <Button variant="soft" size="detail" icon={IconPlus} onClick={() => setEntityModal({ kind })}>
      Agregar
    </Button>
  );

  const warehousesCard = (
    <ListCard
      title="Bodegas"
      subtitle="Destinos disponibles al reportar inventario · clic en el nombre para cambiarlo"
      action={addButton("warehouse")}
      items={warehouses}
      renderRow={renderWarehouse}
      loading={warehousesLoading}
      error={warehousesError}
      emptyText="No hay bodegas registradas."
      noun="bodegas"
    />
  );

  const vehiclesCard = (
    <ListCard
      title="Vehículos"
      subtitle="Flota disponible para armar rutas"
      action={addButton("vehicle")}
      items={vehicles}
      renderRow={renderVehicle}
      loading={vehiclesLoading}
      error={vehiclesError}
      emptyText="No hay vehículos registrados."
      noun="vehículos"
    />
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

      {/* En lg el bloque llega hasta el margen inferior de la página: el menú y
          la tarjeta de la sección se estiran, y las listas paginan lo que no cabe. */}
      <div
        ref={layoutRef}
        style={{ height: layoutHeight ?? undefined }}
        className="grid grid-cols-1 gap-3.5 lg:grid-cols-[220px_minmax(0,1fr)]"
      >
        <SectionMenu
          value={section}
          onChange={setSection}
          counts={{ bodegas: warehouses.length, vehiculos: vehicles.length, lineas: lines.length, subcategorias: subcategories.length, personal: employees.length }}
          companyName={savedCompany.name || DEFAULT_COMPANY.name}
          updatedAt={savedCompany.updatedAt}
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-3.5">
          {section === "empresa" ? (
              <section className="rounded-[14px] border border-line bg-surface px-5 pb-5 pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
          ) : section === "subcategorias" ? (
            <Subcategorias subcategories={subcategories} loading={subcategoriesLoading} error={subcategoriesError} refetch={refetchSubcategories} />
          ) : section === "personal" ? (
            <PersonalPermisos employees={employees} loading={employeesLoading} error={employeesError} refetch={refetchEmployees} />
          ) : (
            <MiCuenta
              account={account}
              loading={accountLoading}
              error={accountError}
              form={accountForm}
              onChange={handleAccountChange}
              storedPassword={myPassword}
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
        />
      ) : null}
      <ConfirmPasswordModal
        state={passwordPrompt}
        busy={saving}
        onChange={(value) => setPasswordPrompt((p) => ({ ...p, value, error: "" }))}
        onClose={() => setPasswordPrompt(null)}
        onConfirm={(password) => handleSave(null, password)}
      />
      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Configuracion;
