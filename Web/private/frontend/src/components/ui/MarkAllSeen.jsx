import { useUnseen } from "../../hooks/useActivity";

/*
  «Marcar todo como visto»: enlace pequeño para la barra de una lista. Solo aparece
  si la pestaña `activityKey` (p. ej. «fabricacion.pedidos») tiene novedades.
*/
// `asRow`: lo pone en su propia línea, alineado a la derecha (cuando la barra no tiene título).
function MarkAllSeen({ activityKey, asRow = false, className = "" }) {
  const { count, markAll } = useUnseen(activityKey);
  if (count <= 0) return null;
  const button = (
    <button type="button" onClick={markAll} className={`shrink-0 text-[12px] font-semibold text-primary-soft-text transition hover:text-primary ${className}`}>
      Marcar todo como visto
    </button>
  );
  return asRow ? <div className="flex justify-end">{button}</div> : button;
}

export default MarkAllSeen;
