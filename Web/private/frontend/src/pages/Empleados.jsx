import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { todayInput } from "../hooks/useBatchForm";
import { useUrlState } from "../hooks/useUrlState";
import { useWorkSchedule } from "../hooks/useWorkSchedule";
import Modal from "../components/ui/Modal";
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

const emptyAttendanceForm = { employee: "", date: "", checkIn: "", checkOut: "" };

/*
  Empleados: Personal (maestro-detalle, solo consulta) y Asistencia (franja
  horaria por día). Agregar, editar y eliminar empleados se hace en
  Configuración > Personal y permisos.
  URL: ?tab= (personal | asistencia), ?id= (empleado abierto), ?mes= (AAAA-MM).
  «Tarde» y las horas extra salen del horario laboral de Configuración.
*/
function Empleados() {
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

  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendanceForm);
  const [savingAttendance, setSavingAttendance] = useState(false);

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
              <Link to="/configuracion?tab=personal" className={buttonClass("secondary", "header")}>
                Gestionar personal
              </Link>
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

    </div>
  );
}

export default Empleados;
