import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Modal from "../ui/Modal";
import ConfirmModal from "../ui/ConfirmModal";
import { Field, SelectField } from "../ui/Field";
import { buttonClass } from "../../lib/buttonStyles";
import { DUI_INPUT_PROPS, formatDui, maskDui } from "../../lib/dui";
import { DEPARTMENTS } from "../../lib/permissions";
import PermissionLine from "./PermissionLine";

const emptyForm = {
  name: "", lastName: "", dui: "", phone: "", email: "", password: "",
  position: "", department: "Fabricación", hourlyRate: "", isActive: true,
};

function toForm(emp) {
  if (!emp) return emptyForm;
  return {
    name: emp.name || "", lastName: emp.lastName || "", dui: formatDui(emp.dui),
    phone: emp.phone || "", email: emp.email || "", password: "",
    position: emp.position || "",
    department: emp.department || "Fabricación",
    hourlyRate: emp.hourlyRate ?? "", isActive: emp.isActive !== false,
  };
}

/*
  Alta y edición de empleados (Configuración > Personal y permisos). Antes
  vivía en Empleados, que ahora solo consulta. Aquí el administrador también
  cambia el correo, la contraseña, el DUI o el teléfono de OTRO empleado; los
  propios se editan en Configuración > Mi cuenta.
    employee: el empleado a editar, o null para uno nuevo.
    onSaved / onDeleted: se llaman tras guardar o eliminar (para recargar).
*/
function EmployeeFormModal({ employee, positions = [], onClose, onSaved, onDeleted }) {
  const { confirm, confirmProps } = useConfirm();
  const [form, setForm] = useState(() => toForm(employee));
  const [saving, setSaving] = useState(false);
  const editing = Boolean(employee);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : name === "dui" ? maskDui(value) : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, hourlyRate: Number(form.hourlyRate) || 0 };
    if (editing && !payload.password) delete payload.password; // no cambiar contraseña si va vacía
    try {
      if (editing) {
        await api.put(`/employees/${employee._id}`, payload);
        toast.success("Empleado actualizado");
      } else {
        await api.post("/employees", payload);
        toast.success("Empleado creado");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!(await confirm(`¿Eliminar a ${employee.name} ${employee.lastName}? Se borra también su historial de asistencia.`, { danger: true }))) return;
    try {
      await api.del(`/employees/${employee._id}`);
      toast.success("Empleado eliminado");
      onDeleted?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={editing ? "Editar empleado" : "Nuevo empleado"}
        size="lg"
        footer={
          <>
            {editing ? (
              <button type="button" onClick={handleDelete} className={`${buttonClass("danger", "modal")} mr-auto`}>
                Eliminar
              </button>
            ) : null}
            <button type="button" onClick={onClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="emp-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="emp-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="name" value={form.name} onChange={handleChange} required />
          <Field label="Apellido" name="lastName" value={form.lastName} onChange={handleChange} required />
          <Field label="DUI" name="dui" value={form.dui} onChange={handleChange} {...DUI_INPUT_PROPS} />
          <Field label="Teléfono" name="phone" value={form.phone} onChange={handleChange} />
          <Field label="Correo" name="email" type="email" value={form.email} onChange={handleChange} required />
          <Field
            label={editing ? "Contraseña (dejar vacío = sin cambio)" : "Contraseña"}
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required={!editing}
          />
          <SelectField label="Área" name="department" value={form.department} onChange={handleChange} options={DEPARTMENTS} />
          <Field label="Puesto" name="position" value={form.position} onChange={handleChange} list="employee-positions" placeholder="Ej. Operario" />
          <datalist id="employee-positions">
            {positions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="sm:col-span-2">
            <PermissionLine employee={form} note />
          </div>
          <Field label="Valor por hora ($)" name="hourlyRate" type="number" step="0.01" value={form.hourlyRate} onChange={handleChange} />
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] font-medium text-ink-2">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 rounded border-line accent-primary" />
            Empleado activo
          </label>
        </form>
      </Modal>
      <ConfirmModal {...confirmProps} />
    </>
  );
}

export default EmployeeFormModal;
