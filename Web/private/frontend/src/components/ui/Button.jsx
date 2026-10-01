import { buttonClass } from "../../lib/buttonStyles";

/*
  Botón del sistema visual (variantes y tamaños en lib/buttonStyles.js).
  El botón de estado "pack" (Empacar) nunca lleva ícono.
*/
function Button({ variant = "primary", size = "header", icon: Icon, className = "", type = "button", children, ...props }) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props}>
      {Icon && variant !== "pack" ? <Icon width={15} height={15} /> : null}
      {children}
    </button>
  );
}

export default Button;
