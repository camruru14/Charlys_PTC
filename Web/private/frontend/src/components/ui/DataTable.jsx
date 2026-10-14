import EmptyState from "./EmptyState";
import UnseenDot from "./UnseenDot";
import { UNSEEN_BG } from "../../lib/unseen";

/*
  Tabla de datos: encabezado de 32px (surface-2, etiquetas en mayúsculas) y
  filas de 44px separadas por line-soft.
  columns = [{ key, label, align, width, render(row) }]
  Novedades: `isUnseen(row)` marca la fila (punto azul y fondo suave) y `onRowSeen(row)`
  se llama al hacer clic en ella, para marcarla vista.
*/
function DataTable({ columns, rows, rowKey = "_id", onRowClick, rowClassName, isUnseen, onRowSeen, empty = "Sin registros." }) {
  if (!rows?.length) {
    return <EmptyState title={empty} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="h-8 bg-surface-2">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={`t-label whitespace-nowrap border-b border-line-soft px-3 first:pl-5 last:pr-5 ${c.align === "right" ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const unseen = Boolean(isUnseen?.(row));
            return (
              <tr
                key={typeof rowKey === "function" ? rowKey(row, i) : row[rowKey] ?? i}
                data-unseen={unseen || undefined}
                onClick={onRowClick || onRowSeen ? () => (onRowClick?.(row), onRowSeen?.(row)) : undefined}
                className={`h-11 border-b border-line-soft transition-colors last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface-2" : ""} ${unseen ? UNSEEN_BG : ""} ${rowClassName?.(row) || ""}`}
              >
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    className={`t-row px-3 first:pl-5 last:pr-5 ${ci === 0 && isUnseen ? "relative" : ""} ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                  >
                    {ci === 0 && isUnseen ? <UnseenDot show={unseen} className="left-2 top-1/2 -translate-y-1/2" /> : null}
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
