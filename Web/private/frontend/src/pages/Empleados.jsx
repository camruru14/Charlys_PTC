import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { todayInput } from "../hooks/useBatchForm";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import { Field, SelectField } from "../components/ui/Field";
import { IconPlus } from "../lib/icons";
import { buttonClass } from "../lib/buttonStyles";
import { attendanceDays, attendanceMonths, defaultMonth } from "../lib/attendance";
import Personal from "./empleados/Personal";
import Asistencia from "./empleados/Asistencia";

const TABS = [
  { key: "personal", label: "Personal" },
  { key: "asistencia", label: "Asistencia" },
];

const DEPARTMENTS = ["Fabricación", "Logística", "Administración", "Almacén", "Finanzas"];

const emptyAttendanceForm = { employee: "", date: "", checkIn: "", checkOut: "" };

const emptyForm = {
  name: "", lastName: "", dui: "", phone: "", email: "", password: "",
  position: "", department: "Fabricación", hourlyRate: "", isActive: true,
};

/*
  Empleados: Personal (maestro-detalle) y Asistencia (franja horaria por día).
  URL: ?tab= (personal | asistencia), ?id= (empleado abierto), ?mes= (AAAA-MM).
  «Tarde» y las horas extra salen del horario laboral de Configuración.
*/
function Empleados() {
  const { confirm, confirmProps } = useConfirm();
  const { data, loading, error, refetch } = useFetch("/employees");
  const { schedule } = useWorkSchedule();
  const [activeTab, setActiveTab] = useUrlState("tab", "personal", { allowed: TABS.map((t) => t.key) });
  const [selectedId, setSelectedId] = useUrlState("id");

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const months = useMemo(() => attendanceMonths(list), [list]);
  const fallbackMonth = defaultMonth(list);
  const [rawMonth, setMonth] = useUrlState("mes", fallbackMonth);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : fallbackMonth;
  const days = useMemo(() => attendanceDays(list, month), [list, month]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [savingAttendance, setSavingAttendance] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditingId(emp._id);
    setForm({
      name: emp.name || "", lastName: emp.lastName || "", dui: emp.dui || "",
      phone: emp.phone || "", email: emp.email || "", password: "",
      position: emp.position || "",
      department: emp.department || "Fabricación",
      hourlyRate: emp.hourlyRate ?? "", isActive: emp.isActive !== false,
    });
    setModalOpen(true);
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "dui") {
      setForm((f) => ({ ...f, dui: value.replace(/\D/g, "").slice(0, 9) }));
      return;
    }
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, hourlyRate: Number(form.hourlyRate) || 0 };
    if (editingId && !payload.password) delete payload.password; // no cambiar contraseña si va vacía
    try {
      if (editingId) {
        await api.put(`/employees/${editingId}`, payload);
        toast.success("Empleado actualizado");
      } else {
        await api.post("/employees", payload);
        toast.success("Empleado creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const emp = list.find((e) => e._id === editingId);
    if (!emp) return;
    if (!(await confirm(`¿Eliminar a ${emp.name} ${emp.lastName}?`, { danger: true }))) return;
    try {
      await api.del(`/employees/${emp._id}`);
      toast.success("Empleado eliminado");
      setModalOpen(false);
      if (selectedId === String(emp._id)) setSelectedId(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openAttendance(emp) {
    setAttendanceForm({ ...emptyAttendanceForm, employee: emp?._id || "", date: todayInput() });
    setAttendanceModalOpen(true);
  }

  const handleAttendanceChange = (e) => setAttendanceForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Marcación manual (todavía no hay app móvil de marcación): entrada/salida
  // se capturan como hora del día elegido, y de ahí se calculan solas las
  // horas trabajadas y las horas extra (por encima de las horas de jornada
  // del horario laboral).
  async function handleAttendanceSubmit(e) {
    e.preventDefault();
    if (!attendanceForm.employee) return toast.error("Selecciona un empleado");
    if (!attendanceForm.date) return toast.error("Selecciona la fecha");
    if (!attendanceForm.checkIn || !attendanceForm.checkOut) return toast.error("Completa hora de entrada y salida");

    const checkIn = new Date(`${attendanceForm.date}T${attendanceForm.checkIn}`);
    const checkOut = new Date(`${attendanceForm.date}T${attendanceForm.checkOut}`);
    if (checkOut <= checkIn) return toast.error("La salida debe ser después de la entrada");

    const workedHours = Number(((checkOut - checkIn) / 3600000).toFixed(2));
    const overtimeHours = Number(Math.max(0, workedHours - schedule.workdayHours).toFixed(2));

    setSavingAttendance(true);
    try {
      await api.post(`/employees/${attendanceForm.employee}/attendance`, {
        date: attendanceForm.date,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        workedHours,
        overtimeHours,
      });
      toast.success("Asistencia registrada");
      setAttendanceModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingAttendance(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Empleados"
        subtitle="Asistencia, horas extra y planillas"
        actions={
          <>
            <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
            {activeTab === "personal" ? (
              <Button icon={IconPlus} onClick={openCreate}>
                Nuevo empleado
              </Button>
            ) : (
              <Button icon={IconPlus} onClick={() => openAttendance(null)}>
                Registrar marcación
              </Button>
            )}
          </>
        }
      />

      {activeTab === "personal" ? (
        <Personal
          employees={list}
          days={days}
          month={month}
          schedule={schedule}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={openEdit}
          onRegister={openAttendance}
        />
      ) : (
        <Asistencia
          days={days}
          months={months}
          month={month}
          onMonth={setMonth}
          schedule={schedule}
          loading={loading}
          error={error}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar empleado" : "Nuevo empleado"}
        size="lg"
        footer={
          <>
            {editingId ? (
              <button type="button" onClick={handleDelete} className={`${buttonClass("danger", "modal")} mr-auto`}>
                Eliminar
              </button>
            ) : null}
            <button type="button" onClick={() => setModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="emp-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="emp-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="name" value={form.name} onChange={handleChange} required />
          <Field label="Apellido" name="lastName" value={form.lastName} onChange={handleChange} required />
          <Field
            label="DUI"
            name="dui"
            value={form.dui}
            onChange={handleChange}
            inputMode="numeric"
            pattern="\d{9}"
            maxLength={9}
            placeholder="123456789"
            title="El DUI debe tener 9 números"
          />
          <Field label="Teléfono" name="phone" value={form.phone} onChange={handleChange} />
          <Field label="Correo" name="email" type="email" value={form.email} onChange={handleChange} required />
          <Field label={editingId ? "Contraseña (dejar vacío = sin cambio)" : "Contraseña"} name="password" type="password" value={form.password} onChange={handleChange} required={!editingId} />
          <Field label="Puesto" name="position" value={form.position} onChange={handleChange} />
          <SelectField label="Área" name="department" value={form.department} onChange={handleChange} options={DEPARTMENTS} />
          <Field label="Valor por hora ($)" name="hourlyRate" type="number" step="0.01" value={form.hourlyRate} onChange={handleChange} />
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2 sm:col-span-2">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 rounded border-line accent-primary" />
            Empleado activo
          </label>
        </form>
      </Modal>

      <Modal
        open={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        title="Registrar marcación"
        footer={
          <>
            <button type="button" onClick={() => setAttendanceModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="attendance-form" disabled={savingAttendance} className={buttonClass("primary", "modal")}>{savingAttendance ? "Guardando…" : "Registrar"}</button>
          </>
        }
      >
        <form id="attendance-form" onSubmit={handleAttendanceSubmit} className="space-y-4">
          <SelectField
            label="Empleado"
            name="employee"
            value={attendanceForm.employee}
            onChange={handleAttendanceChange}
            required
            placeholder="Selecciona un empleado"
            options={list.map((e) => ({ value: e._id, label: `${e.name} ${e.lastName}` }))}
          />
          <Field label="Fecha" name="date" type="date" value={attendanceForm.date} onChange={handleAttendanceChange} max={todayInput()} required />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entrada" name="checkIn" type="time" value={attendanceForm.checkIn} onChange={handleAttendanceChange} required />
            <Field label="Salida" name="checkOut" type="time" value={attendanceForm.checkOut} onChange={handleAttendanceChange} required />
          </div>
          <p className="t-aux">Las horas trabajadas y las horas extra se calculan solas a partir de la entrada y la salida.</p>
        </form>
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Empleados;
