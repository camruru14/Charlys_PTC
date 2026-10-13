import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORICAL_COLORS, OTHERS_COLOR } from "../lib/chartColors";

// Color estable de cada producto en la dona de ventas (igual que lib/productColors.js de la web):
// el color sigue al producto aunque cambie el rango. Se asigna la primera vez que aparece (el
// primer color categórico libre entre los que se muestran) y se recuerda en AsyncStorage.
// «Otros» siempre es gris.
//   const colorOf = useProductColors(["Pajilla jumbo", "Vaso", "Otros"]);
const STORAGE_KEY = "dashboard.productColors";
export const OTHERS_LABEL = "Otros";

export function useProductColors(products) {
  const [stored, setStored] = useState({});
  const key = products.join("\u0001");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === "object") setStored((prev) => ({ ...parsed, ...prev }));
      })
      .catch(() => {});
  }, []);

  const assigned = useMemo(() => {
    const names = (key ? key.split("\u0001") : []).filter((n) => n !== OTHERS_LABEL);
    const map = { ...stored };
    let changed = false;
    for (const name of names) {
      if (CATEGORICAL_COLORS.includes(map[name])) continue;
      const taken = new Set(names.map((n) => map[n]).filter(Boolean));
      map[name] = CATEGORICAL_COLORS.find((c) => !taken.has(c)) || CATEGORICAL_COLORS[Object.keys(map).length % CATEGORICAL_COLORS.length];
      changed = true;
    }
    return { map, changed };
  }, [key, stored]);

  useEffect(() => {
    if (!assigned.changed) return;
    setStored(assigned.map);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(assigned.map)).catch(() => {});
  }, [assigned]);

  return useMemo(() => (name) => (name === OTHERS_LABEL ? OTHERS_COLOR : assigned.map[name] || OTHERS_COLOR), [assigned]);
}

export default useProductColors;
