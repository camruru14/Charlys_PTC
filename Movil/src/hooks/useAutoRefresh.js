import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

// Refresco automático en segundo plano de una pantalla (no hay WebSocket ni
// SSE en el proyecto; es el mismo mecanismo que useAutoRefresh de la web).
// Llama a `refresh` cada `interval` ms SOLO mientras la pantalla está enfocada
// Y la app está en primer plano (AppState "active"), y de inmediato al enfocar
// la pantalla o al traer la app a primer plano (si pasó más de `minGap`). Se
// detiene al salir de la pantalla o al pasar la app a segundo plano.
//   useAutoRefresh(() => refreshQuiet());
// `refresh` se lee de la última render: puede cambiar sin reiniciar el
// intervalo y debe encargarse de no solaparse (useApi.refreshQuiet lo hace).
export function useAutoRefresh(refresh, { interval = 15000, minGap = 1500 } = {}) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });

  useFocusEffect(
    useCallback(() => {
      let last = 0;
      let timer = null;
      const run = () => {
        last = Date.now();
        latest.current();
      };
      const start = () => {
        if (!timer) timer = setInterval(run, interval);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      if (AppState.currentState === "active") {
        run();
        start();
      }
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          if (Date.now() - last >= minGap) run();
          start();
        } else {
          stop();
        }
      });
      return () => {
        stop();
        subscription.remove();
      };
    }, [interval, minGap]),
  );
}

export default useAutoRefresh;
