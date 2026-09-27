import { useLayoutEffect, useState } from "react";

/*
  Alto para que un bloque llegue hasta el margen inferior de la página en
  pantallas lg (>= 1024px): se mide dónde empieza el bloque, porque lo que va
  encima cambia de una pantalla a otra. En pantallas chicas devuelve null
  (alto natural, la página hace scroll).
    const ref = useRef(null);
    const height = useFillHeight(ref, true);
    <div ref={ref} style={{ height: height ?? undefined }}>…</div>
  Lo usan MasterDetail (fill) y Configuración.
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
      setHeight(Math.max(minHeight, Math.floor(window.innerHeight - top - bottomPad)));
    }
    update();
    // Lo de arriba puede cambiar de alto (p. ej. el subtítulo al cambiar de pestaña).
    const observer = new ResizeObserver(update);
    if (el.parentElement) observer.observe(el.parentElement);
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
