import { lineLabel } from "../lib/lineLabel";
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
// Solo con la cuenta de Wompi en sandbox se ofrece la tarjeta de prueba y el
// aviso de "no se cobra dinero real" (ver README). Cualquier otro valor,
// o la variable ausente, se trata como producción.
const WOMPI_SANDBOX = import.meta.env.VITE_WOMPI_SANDBOX === "true";

// Cobro sin confirmar (502 con `unconfirmed`): el cobro pudo hacerse, así que no se permite pagar este
// mismo carrito otra vez durante la sesión del navegador. Se guarda la referencia y la «firma» del
// carrito (productos, colores, tamaños y cantidades): si el cliente cambia el carrito, es otra compra.
const UNCONFIRMED_KEY = "charly:unconfirmed-payment";
const cartSignature = (items) =>
  items
    .map((i) => `${i.productId}:${i.color || ""}:${i.size || ""}:${i.quantity}`)
    .sort()
    .join("|");
const readUnconfirmed = () => {
  try {
    return JSON.parse(sessionStorage.getItem(UNCONFIRMED_KEY) || "null");
  } catch {
    return null;
  }
};

export default function CheckoutPage() {
  const { items, total, clearCart, syncWithCatalog, applyPrices, hasMadeToOrder } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();

  const defaultAddress = customer?.addresses?.find((a) => a.isDefault) || customer?.addresses?.[0];

  const [address, setAddress] = useState(defaultAddress?.address || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [notes, setNotes] = useState("");
  const [card, setCard] = useState({ number: "", month: "", year: "", cvv: "", holderName: "" });
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(readUnconfirmed);
  // El pago aprobado vacía el carrito (clearCart) justo antes de navegar a la
  // confirmación: sin esta bandera, ese vaciado dispara el mismo efecto de
  // "carrito vacío" de abajo y manda al cliente a /carrito en vez de a su
  // pedido recién pagado.
  const [justOrdered, setJustOrdered] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !justOrdered) navigate("/carrito");
  }, [items.length, justOrdered, navigate]);

  // Al abrir el checkout se refrescan precios y disponibilidad desde el catálogo.
  useEffect(() => {
    syncWithCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0 && !justOrdered) {
    return null;
  }

  // Hay un cobro sin confirmar de ESTE carrito: no se vuelve a cobrar.
  const paymentBlocked = Boolean(unconfirmed && unconfirmed.signature === cartSignature(items));

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
    if (paymentBlocked) {
      toast.error(`Tu pago anterior está en revisión (referencia ${unconfirmed.reference}). No intentes de nuevo.`, { duration: 8000 });
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
        // El total que muestra el botón: si el servidor calcula otro (cambió un precio) responde 409
        // y no cobra nada.
        expectedTotal: Number(total.toFixed(2)),
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
      if (error.status === 409 && Array.isArray(error.payload?.products)) {
        // Cambiaron precios: se actualiza el carrito, se avisa y NO se navega ni se cobra.
        applyPrices(error.payload.products);
        toast.error(`${error.message} El total ahora es distinto: revísalo antes de pagar.`, { duration: 7000 });
      } else if (error.status === 502 && error.payload?.unconfirmed) {
        // No sabemos si se cobró: se bloquea el botón para este carrito y se explica qué pasa.
        const blocked = { reference: error.payload.reference, signature: cartSignature(items) };
        try {
          sessionStorage.setItem(UNCONFIRMED_KEY, JSON.stringify(blocked));
        } catch {
          // Sin almacenamiento de sesión: el bloqueo vale mientras la página siga abierta.
        }
        setUnconfirmed(blocked);
        toast.error(error.message, { duration: 15000 });
      } else {
        // 402: el mensaje de la tarjeta (rechazada, inválida o vencida) tal cual.
        toast.error(error.message || "No se pudo procesar el pago.", { duration: error.status === 500 ? 12000 : 5000 });
      }
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
              {WOMPI_SANDBOX && (
                <button
                  type="button"
                  onClick={fillDemoCard}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Usar tarjeta de prueba
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pago procesado por Wompi.
              {WOMPI_SANDBOX && " La cuenta está en modo de prueba: no se cobra dinero real."}
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

          {paymentBlocked && (
            <p className="rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground" role="alert">
              No pudimos confirmar tu pago. No intentes de nuevo: revisaremos tu cobro con la referencia{" "}
              <span className="font-semibold text-foreground">{unconfirmed.reference}</span> y te contactaremos.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || paymentBlocked}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Procesando pago…" : paymentBlocked ? "Pago en revisión" : `Pagar $${total.toFixed(2)}`}
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
                  {item.quantity}x {lineLabel(item)} {item.color ? `(${item.color})` : ""}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="font-display text-lg font-semibold">Total</span>
            <span className="font-display text-lg font-bold">${total.toFixed(2)}</span>
          </div>
          {hasMadeToOrder && (
            <p className="mt-4 text-xs text-muted-foreground">
              Algunos productos se fabrican bajo pedido: se producen al confirmar tu compra y pueden tardar más en entregarse.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
