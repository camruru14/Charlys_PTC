import { useCallback, useRef, useState } from "react";

const closedState = { open: false, title: "", message: "", confirmLabel: "Confirmar", danger: false };

/*
  Confirmación en modal, para reemplazar window.confirm() en todo el sistema
  (los diálogos nativos del navegador no se pueden maquillar ni son
  consistentes con el resto de la interfaz).

  Uso:
    const { confirm, confirmProps } = useConfirm();
    ...
    if (!(await confirm("¿Eliminar este registro?", { danger: true }))) return;
    ...
    <ConfirmModal {...confirmProps} />

  confirm() devuelve una Promise<boolean> que se resuelve en true al
  confirmar o en false al cancelar/cerrar — mismo contrato que tenía
  window.confirm(), así que los call sites solo cambian `if (!window.confirm(msg))`
  por `if (!(await confirm(msg)))` (la función que lo envuelve ya era async).
*/
export function useConfirm() {
  const [state, setState] = useState(closedState);
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef(null);

  const confirm = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setLoading(false);
      setState({
        open: true,
        title: opts.title || (opts.danger ? "Confirmar eliminación" : "Confirmar"),
        message,
        confirmLabel: opts.confirmLabel || (opts.danger ? "Eliminar" : "Confirmar"),
        danger: !!opts.danger,
      });
    });
  }, []);

  function settle(result) {
    setState(closedState);
    setLoading(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  const confirmProps = {
    ...state,
    loading,
    onConfirm: () => settle(true),
    onCancel: () => settle(false),
  };

  return { confirm, confirmProps };
}
