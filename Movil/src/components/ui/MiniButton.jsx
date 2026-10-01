import Button from "./Button";

// Reemplazado por <Button size="small" />; se mantiene para no romper los
// imports existentes. Traduce las variantes viejas a las de Button.
const VARIANT_MAP = {
  primary: "soft",
  neutral: "secondary",
  success: "success",
  danger: "danger",
};

export default function MiniButton({ variant = "primary", ...props }) {
  return <Button size="small" variant={VARIANT_MAP[variant] || "soft"} {...props} />;
}
