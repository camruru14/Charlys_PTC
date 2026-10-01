import EmptyState from "./EmptyState";

/*
  Tabla de datos: encabezado de 32px (surface-2, etiquetas en mayúsculas) y
  filas de 44px separadas por line-soft.
  columns = [{ key, label, align, width, render(row) }]
*/
function DataTable({ columns, rows, rowKey = "_id", onRowClick, rowClassName, empty = "Sin registros." }) {
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
          {rows.map((row, i) => (
            <tr
              key={typeof rowKey === "function" ? rowKey(row, i) : row[rowKey] ?? i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`h-11 border-b border-line-soft last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface-2" : ""} ${rowClassName?.(row) || ""}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`t-row px-3 first:pl-5 last:pr-5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
