import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/*
  Estado guardado en la URL (?tab=, ?id=, …) para que la pestaña activa o el
  registro seleccionado sobrevivan a recargas y se puedan compartir.
    const [tab, setTab] = useUrlState("tab", "articulos");
  Cuando el valor vuelve al predeterminado (o es vacío) el parámetro se quita.
*/
export function useUrlState(key, defaultValue = null, { allowed } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw != null && (!allowed || allowed.includes(raw)) ? raw : defaultValue;

  const setValue = useCallback(
    (next) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next == null || next === "" || next === defaultValue) params.delete(key);
          else params.set(key, next);
          return params;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setSearchParams],
  );

  return [value, setValue];
}

export default useUrlState;
