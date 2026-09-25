/*
  Cuadro en línea que reemplaza a un modal: se abre dentro de la lista, justo
  debajo de la fila que lo abrió.
*/
function InlineResolveBox({ title, children, className = "" }) {
  return (
    <div className={`rounded-[11px] border border-dashed border-select-bar bg-select-bg px-3 py-2.5 ${className}`}>
      {title ? <p className="mb-2 text-[12.5px] font-semibold text-ink">{title}</p> : null}
      {children}
    </div>
  );
}

export default InlineResolveBox;
