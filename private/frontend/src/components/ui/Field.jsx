/*
  Campos de formulario reutilizables con estilo consistente del panel.
  - Field: input de texto/número/email/etc.
  - SelectField: desplegable.
  - TextareaField: área de texto.
*/

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const controlClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function Field({ label, name, type = "text", value, onChange, required, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={controlClass}
        {...rest}
      />
    </label>
  );
}

export function SelectField({ label, name, value, onChange, options = [], required, placeholder }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        className={controlClass}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function TextareaField({ label, name, value, onChange, rows = 3, placeholder }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea
        name={name}
        value={value ?? ""}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className={controlClass}
      />
    </label>
  );
}

export default Field;
