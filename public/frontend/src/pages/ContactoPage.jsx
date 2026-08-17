import { useState } from "react";
import toast from "react-hot-toast";
import Field from "../components/Field";

const faqs = [
  {
    q: "¿Cuál es el pedido mínimo?",
    a: "Depende del producto: lo verás indicado en cada ficha de producto del catálogo (por ejemplo, pelotas desde 250–500 unidades, pajillas desde 500–1000).",
  },
  {
    q: "¿Cómo pago mi pedido?",
    a: "El checkout de la tienda usa Wompi: pagas con tarjeta de crédito o débito de forma segura, sin salir del proceso de compra.",
  },
  {
    q: "¿Puedo personalizar colores o tamaños?",
    a: "Sí, para volúmenes grandes desarrollamos colores y tamaños fuera de catálogo. Escríbenos para cotizar.",
  },
  {
    q: "¿Hacen envíos a todo el país?",
    a: "Sí, coordinamos despachos a nivel nacional una vez confirmado el pago de tu pedido.",
  },
];

export default function ContactoPage() {
  const [form, setForm] = useState({ name: "", company: "", contact: "", message: "" });

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success("¡Gracias! Te contactaremos pronto.");
    setForm({ name: "", company: "", contact: "", message: "" });
  };

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Hablemos
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Un canal directo con la fábrica.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            ¿Prefieres cotizar por volumen antes de comprar en línea? Escríbenos y te
            respondemos en menos de 24 horas hábiles.
          </p>
        </div>
      </section>

      <section id="formulario" className="border-b border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Formulario</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Cuéntanos qué necesitas.
            </h2>
            <form onSubmit={handleSubmit} className="mt-10 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nombre completo" required value={form.name} onChange={update("name")} placeholder="Ana Morales" />
                <Field label="Empresa" value={form.company} onChange={update("company")} placeholder="Opcional" />
              </div>
              <Field
                label="Correo o WhatsApp"
                required
                value={form.contact}
                onChange={update("contact")}
                placeholder="Cómo te contactamos"
              />
              <label className="grid gap-2 text-sm">
                <span className="text-muted-foreground">Cuéntanos más</span>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={update("message")}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground/40"
                  placeholder="Colores, tamaños, cantidades, fechas de entrega…"
                />
              </label>
              <button
                type="submit"
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:bg-foreground/90"
              >
                Enviar mensaje →
              </button>
            </form>
          </div>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-border bg-background p-8">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Canales</p>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span><strong className="font-semibold">WhatsApp ventas:</strong> +503 0000 0000</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span><strong className="font-semibold">Correo:</strong> ventas@industriascharly.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span><strong className="font-semibold">Horario:</strong> Lun–Sáb 7:00–18:00</span>
                </li>
              </ul>
              <p className="mt-6 text-xs text-muted-foreground">
                * Datos de contacto de ejemplo — reemplázalos por los reales del equipo.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Preguntas frecuentes</p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Antes de escribir, quizá lo respondemos aquí.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-background p-6 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-lg font-semibold tracking-tight">
                  {f.q}
                  <span className="mt-1 text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
