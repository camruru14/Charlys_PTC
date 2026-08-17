import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Field from "../components/Field";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

// Tarjeta de prueba de Wompi (cuenta en modo sandbox: no cobra dinero real,
// pero la transacción sí viaja a la API de Wompi).
const TARJETA_DEMO = { number: "4573 6900 0199 0693", cvv: "835", month: "12", year: "2029" };

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();

  const defaultAddress = customer?.addresses?.find((a) => a.isDefault) || customer?.addresses?.[0];

  const [address, setAddress] = useState(defaultAddress?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [notes, setNotes] = useState("");
  const [card, setCard] = useState({ number: "", month: "", year: "", cvv: "", holderName: "" });
  const [submitting, setSubmitting] = useState(false);
  // El pago aprobado vacía el carrito (clearCart) justo antes de navegar a la
  // confirmación: sin esta bandera, ese vaciado dispara el mismo efecto de
  // "carrito vacío" de abajo y manda al cliente a /carrito en vez de a su
  // pedido recién pagado.
  const [justOrdered, setJustOrdered] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !justOrdered) navigate("/carrito");
  }, [items.length, justOrdered, navigate]);

  if (items.length === 0 && !justOrdered) {
    return null;
  }

  const updateCard = (field) => (e) => setCard((c) => ({ ...c, [field]: e.target.value }));

  const fillDemoCard = () => {
    setCard((c) => ({ ...c, ...TARJETA_DEMO }));
    toast("Tarjeta de prueba cargada", { icon: "💳" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!address.trim()) {
      toast.error("Agrega una dirección de envío.");
      return;
    }
    if (!card.number.replace(/\s/g, "") || !card.month || !card.year || !card.cvv) {
      toast.error("Completa los datos de la tarjeta.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          color: i.color,
          size: i.size,
        })),
        address,
        phone,
        notes,
        card: {
          number: card.number,
          month: card.month,
          year: card.year,
          cvv: card.cvv,
          holderName: card.holderName,
        },
      };

      // Solo si Wompi aprueba el cobro el backend crea el pedido — si no,
      // el carrito sigue intacto para reintentar con otra tarjeta.
      const { order } = await api.post("/orders/checkout", payload);
      setJustOrdered(true);
      clearCart();
      navigate(`/pedido/${order._id}/confirmacion`);
    } catch (error) {
      toast.error(error.message || "No se pudo procesar el pago.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Checkout</h1>
      <p className="mt-2 text-muted-foreground">
        El pago se procesa aquí mismo con Wompi, sin salir del sitio.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-border bg-card p-8">
          <Field
            label="Dirección de envío"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección completa, referencia y municipio"
            required
          />
          <Field
            label="Teléfono de contacto"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+503 0000 0000"
          />
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Notas del pedido (opcional)
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </label>

          <div className="rounded-2xl border border-border bg-secondary/40 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Datos de la tarjeta</p>
              <button
                type="button"
                onClick={fillDemoCard}
                className="text-xs font-medium text-primary hover:underline"
              >
                Usar tarjeta de prueba
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pago procesado por Wompi. La cuenta está en modo de prueba: no se cobra dinero real.
            </p>

            <div className="mt-4 space-y-4">
              <Field
                label="Número de tarjeta"
                inputMode="numeric"
                placeholder="4573 6900 0199 0693"
                value={card.number}
                onChange={updateCard("number")}
                required
              />
              <Field
                label="Nombre del titular"
                placeholder="Como aparece en la tarjeta"
                value={card.holderName}
                onChange={updateCard("holderName")}
              />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Mes" inputMode="numeric" placeholder="12" value={card.month} onChange={updateCard("month")} required />
                <Field label="Año" inputMode="numeric" placeholder="2029" value={card.year} onChange={updateCard("year")} required />
                <Field label="CVV" inputMode="numeric" placeholder="835" value={card.cvv} onChange={updateCard("cvv")} required />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Procesando pago…" : `Pagar $${total.toFixed(2)}`}
          </button>
        </form>

        <div className="h-fit rounded-3xl border border-border bg-card p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tu pedido
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((item) => (
              <li key={`${item.productId}-${item.color}-${item.size}`} className="flex justify-between">
                <span className="text-muted-foreground">
                  {item.quantity}x {item.name} {item.color ? `(${item.color})` : ""}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="font-display text-lg font-semibold">Total</span>
            <span className="font-display text-lg font-bold">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
