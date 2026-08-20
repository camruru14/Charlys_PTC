import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

// El pago se resuelve dentro de POST /orders/checkout (tokenización directa
// con Wompi): si esta página existe, el pedido ya fue pagado. No hay estado
// "pendiente" que verificar ni reintentar aquí.
const STATUS_COPY = {
  Pagado: {
    title: "¡Pago confirmado!",
    tone: "text-green-600",
    desc: "Tu pedido está siendo procesado. Te contactaremos para coordinar la entrega.",
  },
};

export default function PedidoConfirmacionPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      try {
        const { order } = await api.get(`/orders/${id}`);
        setOrder(order);
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [id]);

  if (loading) {
    return <p className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">Cargando pedido…</p>;
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">No encontramos tu pedido</h1>
        <p className="mt-3 text-muted-foreground">
          Si iniciaste sesión con otra cuenta o tu sesión expiró, entra a{" "}
          <Link to="/cuenta/pedidos" className="text-primary hover:underline">
            Mis pedidos
          </Link>{" "}
          para revisarlo.
        </p>
      </section>
    );
  }

  const copy = STATUS_COPY[order.paymentStatus] || STATUS_COPY.Pagado;

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className={`font-display text-3xl font-bold ${copy.tone}`}>{copy.title}</h1>
      <p className="mt-3 text-muted-foreground">{copy.desc}</p>

      <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-left">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Número de pedido</span>
          <span className="font-display font-semibold">{order.orderNumber}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display font-semibold">${order.total.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estado del pago</span>
          <span className="font-medium">{order.paymentStatus}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estado del pedido</span>
          <span className="font-medium">{order.status}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/cuenta/pedidos"
          className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          Ver mis pedidos
        </Link>
      </div>
    </section>
  );
}
