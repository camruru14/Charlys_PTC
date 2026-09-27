import { createContext } from "react";

/*
  Memoria de la sesión con el último registro abierto en cada pantalla
  maestro-detalle (Map pantalla → id). El Provider vive en
  SelectionMemoryContext.jsx y lo monta el Layout, así sobrevive a los
  cambios de pestaña y de módulo, pero se borra al recargar o al cerrar
  sesión. Se lee con useRememberedSelection (hooks/).
*/
export const SelectionMemoryContext = createContext(null);
