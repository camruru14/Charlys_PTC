/*
  Flecha desplegable para filas expandibles: va en una columna final de 18px
  y gira 180° al abrir. La fila completa debe ser clicable.
*/
function DisclosureChevron({ open }) {
  return (
    <span className="flex w-[18px] shrink-0 items-center justify-center text-chevron" aria-hidden="true">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export default DisclosureChevron;
