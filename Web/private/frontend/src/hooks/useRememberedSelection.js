import { useContext, useEffect, useRef } from "react";
import { SelectionMemoryContext } from "../context/selectionMemory";

/*
  Selección inicial de una pantalla maestro-detalle. El id seleccionado sigue
  viviendo en la URL (useUrlState); este hook solo decide con qué registro
  arranca la pantalla y recuerda el último abierto durante la sesión.
    useRememberedSelection("fabricacion/lotes", {
      selectedId, setSelectedId, ids: visible.map((b) => b._id), ready: !loading,
    });
  - screen: clave única de la pantalla (cada una recuerda lo suyo).
  - ids: los registros de la lista tal como se muestran, en su orden.
  - ready: false mientras los datos cargan (la lista aún no es la real).
  Al montar, en cuanto hay datos: si la URL ya trae un id que está en la
  lista, se respeta; si no, se abre el último recordado de esta pantalla y,
  si ese ya no está en la lista (o no hay ninguno), el primero. Con la lista
  vacía no se toca nada. Solo se decide una vez por montaje: después, filtrar
  o borrar se comporta como siempre.
*/
export function useRememberedSelection(screen, { selectedId, setSelectedId, ids, ready = true }) {
  const memory = useContext(SelectionMemoryContext);
  const resolved = useRef(false);
  const idList = ids.map(String);
  const current = selectedId == null ? null : String(selectedId);
  const inList = current != null && idList.includes(current);

  // Guarda cada selección válida (clic en la lista o cualquier otro cambio).
  useEffect(() => {
    if (memory && inList) memory.set(screen, current);
  }, [memory, screen, current, inList]);

  const first = idList[0];
  const hasItems = idList.length > 0;
  const saved = memory?.get(screen);
  const savedInList = saved != null && idList.includes(saved);

  useEffect(() => {
    if (resolved.current || !ready || !hasItems) return;
    resolved.current = true;
    if (inList) return;
    setSelectedId(savedInList ? saved : first);
  }, [ready, hasItems, inList, savedInList, saved, first, setSelectedId]);
}

export default useRememberedSelection;
