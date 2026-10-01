import StatusPill from "../ui/StatusPill";
import DataTable from "../ui/DataTable";
import ColorSwatch from "../ui/ColorSwatch";
import Button from "../ui/Button";
import { batchState, batchStart } from "../../lib/batchFlow";
import { fmtDateYear, fmtNumber } from "../../lib/format";

/*
  Tabla del historial de lotes (páginas de historial). Si se pasan
  onEdit/onDelete, se muestra una columna de acciones.
*/
function BatchTable({ batches = [], showOperator = false, onEdit, onDelete }) {
  const columns = [
    { key: "batchNumber", label: "Lote", render: (b) => <span className="t-row-name whitespace-nowrap tabular-nums">{b.batchNumber}</span> },
    {
      key: "date",
      label: "Fecha",
      render: (b) => <span className="whitespace-nowrap tabular-nums">{fmtDateYear(batchStart(b)?.date || b.createdAt)}</span>,
    },
    { key: "product", label: "Producto", render: (b) => b.product || "—" },
    {
      key: "color",
      label: "Color",
      render: (b) => (
        <span className="flex items-center gap-2">
          <ColorSwatch color={b.color} />
          {b.color || "—"}
        </span>
      ),
    },
    { key: "line", label: "Línea", render: (b) => <span className="whitespace-nowrap">{b.productionLine || "—"}</span> },
    { key: "produced", label: "Producido", align: "right", render: (b) => fmtNumber(b.producedQuantity) },
    { key: "status", label: "Estado", render: (b) => <StatusPill status={batchState(b)} domain="lote" /> },
  ];

  if (showOperator) {
    columns.push({
      key: "operator",
      label: "Operario",
      render: (b) => <span className="whitespace-nowrap">{b.operator ? `${b.operator.name} ${b.operator.lastName}` : "—"}</span>,
    });
  }

  if (onEdit || onDelete) {
    columns.push({
      key: "actions",
      label: "",
      align: "right",
      render: (b) => (
        <span className="flex justify-end gap-1.5">
          {onEdit ? (
            <Button variant="secondary" size="row" onClick={() => onEdit(b)}>
              Editar
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="secondary" size="row" className="!text-tone-rose-text" onClick={() => onDelete(b)}>
              Eliminar
            </Button>
          ) : null}
        </span>
      ),
    });
  }

  return <DataTable columns={columns} rows={batches} empty="No se encontraron lotes con esos criterios." />;
}

export default BatchTable;
