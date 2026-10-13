import { useEffect, useRef, useState } from "react";

// Mecánica compartida por todo dropdown propio del panel (SelectField y
// FilterSelect): abre/cierra, calcula la posición fija del panel contra el
// botón disparador, y lo cierra si la ventana cambia de tamaño o se hace
// scroll afuera del panel — el scroll DENTRO de la lista de opciones no
// cuenta, así se puede bajar para ver más sin que se cierre solo (ver el
// porqué de position: fixed en vez de absolute: un ancestro con
// overflow-y-auto, como el contenido de Modal.jsx, recorta un panel
// absolute aunque su posición esté bien calculada).
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleResize() {
      setOpen(false);
    }
    function handleScroll(e) {
      if (rootRef.current && rootRef.current.contains(e.target)) return;
      setOpen(false);
    }
    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  // minWidth (opcional): ancho mínimo del panel; si es mayor que el botón, el
  // panel se alinea a su borde derecho.
  function toggleOpen(minWidth = 0) {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const width = Math.max(r.width, minWidth);
      // Alineado al borde derecho del botón, sin salirse de la ventana.
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setRect({ top: r.bottom + 4, left, width });
    }
    setOpen((o) => !o);
  }

  return { open, setOpen, rect, rootRef, triggerRef, toggleOpen };
}

export default useDropdown;
