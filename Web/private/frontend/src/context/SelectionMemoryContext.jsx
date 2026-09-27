import { useState } from "react";
import { SelectionMemoryContext } from "./selectionMemory";

/*
  Provider de la memoria de selección (ver context/selectionMemory.js). Es un
  Map mutable: guardar una selección no necesita volver a pintar nada.
*/
export function SelectionMemoryProvider({ children }) {
  const [memory] = useState(() => new Map());
  return <SelectionMemoryContext.Provider value={memory}>{children}</SelectionMemoryContext.Provider>;
}

export default SelectionMemoryProvider;
