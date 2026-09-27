import { permissionSummary } from "../../lib/permissions";

const SCOPE_CLASS = {
  global: "bg-tone-green text-tone-green-text",
  exclusivo: "bg-tone-blue text-tone-blue-text",
  parcial: "bg-tone-blue text-tone-blue-text",
  ninguno: "bg-tone-gray text-tone-gray-text",
};

/*
  Línea informativa de permisos de un empleado según su área y puesto (ver
  lib/permissions.js). Todavía no restringe nada; `note` agrega la aclaración.
*/
function PermissionLine({ employee, note = false }) {
  const { scope, text } = permissionSummary(employee);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${SCOPE_CLASS[scope]}`}>{text}</span>
      {note ? <span className="t-aux">Informativo: según área y puesto; todavía no restringe el acceso.</span> : null}
    </p>
  );
}

export default PermissionLine;
