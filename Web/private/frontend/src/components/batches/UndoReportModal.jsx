import Modal from "../ui/Modal";
import { buttonClass } from "../../lib/buttonStyles";

/*
  Modal de confirmación para deshacer el reporte de un lote (clic en la
  etiqueta "Reportado" en Fabricación). Al confirmar, el lote queda igual
  (producción, residuos y estado no cambian), solo deja de estar "reportado"
  (vuelve a mostrar el botón "Reportar") y desaparece de Inventario > Lotes
  Reportados. Si el artículo ya se había enviado a almacén, ese stock se
  conserva intacto en Artículos en almacén.
*/
function UndoReportModal({ open, onClose, target, handleConfirm, undoing }) {
  if (!target) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Deshacer reporte · ${target.batchNumber}`}
      footer={
        <>
          <button onClick={onClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
          <button onClick={handleConfirm} disabled={undoing} className={buttonClass("danger", "modal")}>
            {undoing ? "Deshaciendo…" : "Deshacer reporte"}
          </button>
        </>
      }
    >
      <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
        ¿Deshacer el reporte de <strong>{target.batchNumber}</strong> ({target.product})? El lote queda igual (su
        producción y estado no cambian), solo deja de estar reportado y se quita de Inventario &gt; Lotes Reportados.
        Si ese artículo ya se había enviado a almacén, su stock se conserva sin cambios en Artículos en almacén.
      </p>
    </Modal>
  );
}

export default UndoReportModal;
