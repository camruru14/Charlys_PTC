import { useEffect, useState } from "react";

/*
  true desde 1280 px de ancho (xl). Finanzas y Dashboard llenan el alto de la página (sin scroll) a
  partir de ahí; más angosto sus bloques se apilan y la página hace scroll.
*/
export function useWideLayout() {
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

export default useWideLayout;
