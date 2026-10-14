// Espera a que una hoja (BottomSheet) termine de cerrarse antes de abrir algo encima: el selector
// de fotos, un Alert o el selector de fecha. En iOS no se puede presentar un controlador nuevo
// mientras el Modal de la hoja todavía se está yendo (la animación de salida dura ~200 ms), y la
// acción simplemente no hace nada. Úsalo así:
//   setSheet(false);
//   afterSheetClose(() => Alert.alert(...));
export const SHEET_CLOSE_MS = 280;

export function afterSheetClose(fn) {
  return setTimeout(fn, SHEET_CLOSE_MS);
}

export default afterSheetClose;
