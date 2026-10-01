import { useEffect, useState } from "react";

const toGroups = (items, groupOf) => new Map(items.map((item) => [String(item._id), groupOf(item)]));

/*
  Ids de los elementos que cambiaron de grupo en la última actualización de
  datos, durante `duration` ms (para resaltar la tarjeta que se movió).
    const moved = useMovedIds(orders, dispatchGroup);
    <Row className={moved.has(String(o._id)) ? "row-moved" : ""} />
  La primera carga no cuenta como movimiento.
*/
export function useMovedIds(items, groupOf, duration = 2000) {
  const key = items.map((item) => `${item._id}:${groupOf(item)}`).join("|");
  const [state, setState] = useState(() => ({ key, groups: toGroups(items, groupOf), moved: [] }));

  // Se compara con la lectura anterior durante el render (patrón «derivar de props»).
  if (state.key !== key) {
    const groups = toGroups(items, groupOf);
    const moved = [...groups].filter(([id, group]) => state.groups.has(id) && state.groups.get(id) !== group).map(([id]) => id);
    setState({ key, groups, moved: moved.length ? moved : state.moved });
  }

  const { moved } = state;
  useEffect(() => {
    if (!moved.length) return undefined;
    const timer = setTimeout(() => setState((s) => (s.moved === moved ? { ...s, moved: [] } : s)), duration);
    return () => clearTimeout(timer);
  }, [moved, duration]);

  return new Set(moved);
}

export default useMovedIds;
