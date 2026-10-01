import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

// Un color por estado del pedido (nuestro enum real de Order.js, no el de
// Applefly), mismo criterio que ORDER_STATUS_TONE en
// private/frontend/src/pages/Pedidos.jsx: cada etapa se lee de un vistazo.
const STATUS_STYLES = {
  Pendiente: "bg-slate-100 text-slate-700",
  Procesando: "bg-blue-100 text-blue-700",
  "En Fabricación": "bg-amber-100 text-amber-700",
  Empacado: "bg-purple-100 text-purple-700",
  "En Tránsito": "bg-sky-100 text-sky-700",
  Entregado: "bg-green-100 text-green-700",
};

const money = (n) => `$${(n ?? 0).toFixed(2)}`;

// Chevron de trazo, mismo estilo que los íconos del Navbar.
const Chevron = ({ open }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });

/*
  Historial de pedidos del cliente, un pedido por tarjeta (misma estructura
  que D:\Applefly\public\frontend\src\screens\MisPedidos.jsx: encabezado con
  fecha + N° + insignia de estado, líneas de producto, pie con dirección +
  total), pero con nuestros tokens Tailwind y el campo real items[]/customer
  del modelo Order (no el products[]/address plano de Applefly).
*/
export default function MisPedidosPage() {
  const { data: orders, loading, error } = useFetch("/orders/mine");
  const list = Array.isArray(orders) ? orders : [];
  // Pedidos abiertos (por _id); abrir uno no cierra los demás.
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight">Mis pedidos</h1>
      <p className="mt-2 text-muted-foreground">
        {loading
          ? "Cargando tus pedidos…"
          : `${list.length} ${list.length === 1 ? "pedido realizado" : "pedidos realizados"}`}
      </p>

      {error && <p className="mt-10 text-red-600">{error.message || "No se pudieron cargar tus pedidos."}</p>}

      {!loading && !error && list.length === 0 && (
        <div className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
          <div className="text-4xl">📦</div>
          <h2 className="mt-3 font-display text-lg font-semibold">Todavía no tienes pedidos</h2>
          <p className="mt-1 text-muted-foreground">Cuando compres algo, aquí podrás seguir su estado.</p>
          <Link
            to="/productos"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Explorar catálogo
          </Link>
        </div>
      )}

      <div className="mt-10 space-y-5">
        {list.map((order) => {
          const open = expanded.has(order._id);
          const detailId = `pedido-${order._id}-detalle`;
          const subtotal = (order.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
          return (
            <article key={order._id} className="rounded-3xl border border-border bg-card p-6">
              {/* Resumen (lo mismo de siempre): clic o Enter/Espacio abre y cierra. */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => toggle(order._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(order._id);
                  }
                }}
                className="cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    <p className="font-display font-semibold">Pedido {order.orderNumber}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        STATUS_STYLES[order.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {order.status}
                    </span>
                    <Chevron open={open} />
                  </div>
                </header>

                <div className="divide-y divide-border/60">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{item.quantity}×</span> {item.product}
                        {item.color ? ` (${item.color})` : ""}
                      </span>
                      <span className="font-medium">${item.subtotal?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">Enviar a: {order.customer?.address || "—"}</p>
                  <p className="font-display text-lg font-bold">${order.total?.toFixed(2)}</p>
                </footer>
              </div>

              {open && (
                <div id={detailId} className="mt-4 grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Envío y pago
                    </p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Dirección</dt>
                        <dd className="font-medium">{order.customer?.address || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Teléfono</dt>
                        <dd className="font-medium">{order.customer?.phone || "—"}</dd>
                      </div>
                      {/* Sin transacción de pago asociada, esta línea no se muestra. */}
                      {order.payment?.cardLast4 && (
                        <div>
                          <dt className="text-muted-foreground">Método de pago</dt>
                          <dd className="font-medium">Tarjeta terminada en {order.payment.cardLast4}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Resumen
                    </p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{money(subtotal)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      El envío se coordina después del pago según tu dirección.
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <span className="font-display font-semibold">Total</span>
                      <span className="font-display font-bold">{money(order.total)}</span>
                    </div>
                  </div>

                  <Link to="/contacto" className="justify-self-start text-sm font-medium text-primary hover:underline sm:col-span-2">
                    ¿Necesitas ayuda con este pedido?
                  </Link>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
