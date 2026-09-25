/*
  Clases de botón del sistema visual. Las usa <Button /> y, directamente,
  los <button> que necesitan atributos propios (ej. type="submit" form="…").
  variant: primary | soft | secondary | danger | warning
           start (Iniciar) | stop (Detener) | pack (Empacar) | resume (Reanudar)
  size:    header (38px, encabezado de página) | detail (34px, encabezado de
           detalle) | modal (36px, pie de modal) | row (29px, dentro de una fila)
*/

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  soft: "bg-primary-soft text-primary-soft-text hover:bg-select-bg",
  secondary: "border border-line bg-surface text-ink-2 hover:bg-surface-2",
  danger: "bg-tone-rose-text text-white hover:bg-tone-rose-dot",
  warning: "bg-tone-amber-text text-white hover:bg-tone-amber-dot",
  start: "bg-tone-amber text-tone-amber-text hover:brightness-95",
  stop: "bg-tone-blue text-tone-blue-text hover:brightness-95",
  pack: "bg-tone-green text-tone-green-text hover:brightness-95",
  resume: "border border-line bg-surface text-ink-2 hover:bg-surface-2",
};

const SIZES = {
  header: "h-[38px] rounded-[10px] px-4 text-[13px]",
  detail: "h-[34px] rounded-[9px] px-3.5 text-[12.5px]",
  modal: "h-9 rounded-[9px] px-4 text-[13px]",
  row: "h-[29px] rounded-[8px] px-2.5 text-[12.5px]",
};

export function buttonClass(variant = "primary", size = "header") {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]}`;
}
