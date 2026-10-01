import { useId } from "react";

/*
  Campo de cantidad controlado con el TEXTO como estado. Deja teclear
  libremente (incluso vacío o por encima del máximo) y solo filtra que entren
  dígitos; la validación la hace el padre con validateQuantity() al pulsar
  «Agregar». El padre también controla `error` y lo limpia en cuanto el
  usuario vuelve a modificar el campo.
*/
export default function QuantityInput({
  value,
  onChange,
  error,
  hint,
  label,
  id,
  inputRef,
  className = "",
  inputClassName = "w-32 px-4 py-2",
  ...inputProps
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <input
        {...inputProps}
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block rounded-xl border bg-background text-sm outline-none transition focus:ring-2 ${
          error
            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
            : "border-border focus:border-primary focus:ring-primary/20"
        } ${label ? "mt-1" : ""} ${inputClassName}`}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      )}
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}
