import { useLayoutEffect, useState } from "react";

/*
  Alto para que un bloque llegue hasta el margen inferior de la página en
  pantallas lg (>= 1024px): se mide dónde empieza el bloque, porque lo que va
  encima cambia de una pantalla a otra. En pantallas chicas devuelve null
  (alto natural, la página hace scroll).
    const ref = useRef(null);
    const height = useFillHeight(ref, true);
    <div ref={ref} style={{ height: height ?? undefined }}>…</div>
  minHeight (520 por defecto): alto mínimo del bloque; Finanzas usa uno menor
  para que en una ventana baja (1366×768) la página siga sin scroll.
  Lo usan MasterDetail (fill), Configuración, Finanzas y las tablas paginadas.
*/
export function useFillHeight(ref, enabled = true, minHeight = 520) {
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const wide = window.matchMedia("(min-width: 1024px)");
    function update() {
      if (!wide.matches) {
        setHeight(null);
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      const main = el.closest("main");
      const bottomPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      // Sin setHeight si el valor no cambió: el alto que se aplica al bloque cambia
      // el tamaño de lo observado, pero no su posición, así que no hay bucle.
      const next = Math.max(minHeight, Math.floor(window.innerHeight - top - bottomPad));
      setHeight((prev) => (prev === next ? prev : next));
    }
    update();
    // Lo de arriba puede cambiar de alto (p. ej. el subtítulo al cambiar de pestaña,
    // o las categorías que aparecen en el registro rápido de Finanzas): se observa
    // el contenedor directo y el <main> que contiene la página.
    const observer = new ResizeObserver(update);
    if (el.parentElement) observer.observe(el.parentElement);
    const main = el.closest("main");
    if (main) observer.observe(main);
    window.addEventListener("resize", update);
    wide.addEventListener("change", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      wide.removeEventListener("change", update);
    };
  }, [ref, enabled, minHeight]);
  return height;
}

export default useFillHeight;
