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
        {list.map((order) => (
          <article key={order._id} className="rounded-3xl border border-border bg-card p-6">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                <p className="font-display font-semibold">Pedido {order.orderNumber}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  STATUS_STYLES[order.status] || "bg-slate-100 text-slate-700"
                }`}
              >
                {order.status}
              </span>
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
          </article>
        ))}
      </div>
    </section>
  );
}
