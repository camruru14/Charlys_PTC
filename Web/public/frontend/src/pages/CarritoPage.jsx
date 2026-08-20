import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function CarritoPage() {
  const { items, updateQuantity, removeItem, total } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();

  const goToCheckout = () => {
    navigate(customer ? "/checkout" : "/cuenta/login", {
      state: { from: { pathname: "/checkout" } },
    });
  };

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Tu carrito está vacío</h1>
        <p className="mt-3 text-muted-foreground">Explora el catálogo y agrega productos.</p>
        <Link
          to="/productos"
          className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Ver catálogo
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Tu carrito</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {items.map((item) => {
            const key = `${item.productId}-${item.color}-${item.size}`;
            return (
              <div
                key={key}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[item.color, item.size].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item)}
                      className="text-xs text-muted-foreground hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      min={item.minOrderQuantity}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item, Number(e.target.value))}
                      className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    <span className="font-display text-sm font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-fit rounded-3xl border border-border bg-card p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resumen
          </p>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${total.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            El envío se coordina después del pago según tu dirección.
          </p>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="font-display text-lg font-semibold">Total</span>
            <span className="font-display text-lg font-bold">${total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={goToCheckout}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Continuar al pago
          </button>
        </div>
      </div>
    </section>
  );
}
