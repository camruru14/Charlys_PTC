import { useLayoutEffect, useRef, useState } from "react";

/*
  Ancho y alto actuales de un elemento (se actualizan con ResizeObserver). Las gráficas SVG de
  components/charts lo usan para dibujar a tamaño real (así los textos no se escalan).
    const [ref, { width, height }] = useElementSize();
    <div ref={ref} className="min-h-0 flex-1">…</div>
*/
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const width = Math.floor(el.clientWidth);
      const height = Math.floor(el.clientHeight);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

export default useElementSize;
