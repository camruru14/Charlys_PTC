import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useCart } from "../context/CartContext";
import { PRODUCT_COLOR_HEX } from "../lib/catalogOptions";
import { validateQuantity } from "../lib/quantity";
import QuantityInput from "./QuantityInput";

const fmt = (n) => Number(n).toLocaleString("en-US");

/*
  Modal para elegir color, tamaño (si el producto tiene) y cantidad antes de
  agregar al carrito. Se monta solo mientras está abierto (ProductCard), así
  el estado se reinicia cada vez que se abre. Va en un portal a document.body
  porque la tarjeta tiene overflow-hidden y está dentro de un grupo con hover.
*/
export default function QuickAddModal({ product, onClose }) {
  const { addItem } = useCart();
  const titleId = useId();
  const quantityRef = useRef(null);
  const min = product.minOrderQuantity || 1;
  const image = product.images?.[0]?.url;

  const [color, setColor] = useState(product.colors?.[0] || "");
  const [size, setSize] = useState(product.sizes?.[0] || "");
  const [quantity, setQuantity] = useState(String(min));
  const [error, setError] = useState("");

  // Foco en la cantidad al abrir, bloqueo del scroll del body y foco de
  // vuelta al botón que abrió el modal al cerrar.
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    quantityRef.current?.focus();
    quantityRef.current?.select();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const parsed = validateQuantity(quantity, min);

  const handleQuantityChange = (text) => {
    setQuantity(text);
    if (error) setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = validateQuantity(quantity, min);
    if (!result.ok) {
      setError(result.message);
      quantityRef.current?.focus();
      return;
    }
    const capped = addItem(product, { color, size, quantity: result.value });
    if (!capped) toast.success(`${product.name} agregado al carrito`);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
        noValidate
        className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            {image && <img src={image} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold leading-tight">
              {product.name}
            </h2>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {product.category}
            </span>
            <p className="mt-1 text-sm">
              <span className="font-display font-bold">${product.price.toFixed(2)}</span>{" "}
              <span className="text-xs text-muted-foreground">c/u</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {product.colors?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Color</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-pressed={color === c}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                      color === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-inset ring-foreground/10"
                      style={{ backgroundColor: PRODUCT_COLOR_HEX[c] || "#cbd5e1" }}
                    />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.sizes?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tamaño</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      size === s
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <QuantityInput
            label="Cantidad"
            value={quantity}
            onChange={handleQuantityChange}
            error={error}
            hint={`Mínimo ${fmt(min)} unidades`}
            inputRef={quantityRef}
            inputClassName="w-40 px-4 py-2"
          />
        </div>

        <p className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-display text-lg font-bold">
            {parsed.ok ? `$${(product.price * parsed.value).toFixed(2)}` : "—"}
          </span>
        </p>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium transition hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Agregar al carrito
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
