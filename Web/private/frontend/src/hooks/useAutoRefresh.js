import { useEffect, useRef } from "react";

/*
  Refresco automático en segundo plano (no hay WebSocket ni SSE en el
  proyecto): llama a `refresh` cada `interval` ms mientras la pestaña del
  navegador está visible, y de inmediato al volver a ella o al enfocar la
  ventana (si pasó más de `minGap`). Se detiene al desmontar el componente.
    useAutoRefresh(() => refetch({ silent: true }));
  `refresh` se lee de la última render: puede cambiar sin reiniciar el
  intervalo, y debe encargarse de no solaparse (useFetch lo hace con silent).
*/
export function useAutoRefresh(refresh, { interval = 15000, minGap = 1500, enabled = true } = {}) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const visible = () => document.visibilityState === "visible";
    const run = () => {
      last = Date.now();
      latest.current();
    };
    const tick = () => {
      if (visible()) run();
    };
    const wake = () => {
      if (visible() && Date.now() - last >= minGap) run();
    };
    const id = setInterval(tick, interval);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [interval, minGap, enabled]);
}

export default useAutoRefresh;
