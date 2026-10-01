import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

// El checkout solo crea el pedido si Wompi aprueba el cobro: todo pedido que
// llega aquí está pagado, así que el texto es fijo (no hay estado de pago).
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

  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-bold text-green-600">¡Pago confirmado!</h1>
      <p className="mt-3 text-muted-foreground">
        Tu pedido está siendo procesado. Te contactaremos para coordinar la entrega.
      </p>

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
          <span className="text-sm text-muted-foreground">Pago</span>
          <span className="font-medium">Pagado con tarjeta</span>
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
