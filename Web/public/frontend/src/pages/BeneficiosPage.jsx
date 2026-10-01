import { Link } from "react-router-dom";
import heroBalls from "../assets/hero-balls.jpeg";
import ballCloseup from "../assets/ball-closeup.jpeg";
import straws from "../assets/straws.jpg";

const stats = [
  ["+15", "años en el mercado"],
  ["24 h", "despacho promedio"],
  ["50+", "colores disponibles"],
  ["500K+", "unidades mensuales"],
  ["98%", "clientes recurrentes"],
  ["0", "intermediarios"],
];

const useCases = [
  {
    title: "Eventos y fiestas",
    desc: "Piscinas de bolas, centros de mesa, decoración temática. El color convierte cualquier espacio en una experiencia memorable.",
  },
  {
    title: "Restaurantes y cafés",
    desc: "Pajillas en colores que combinan con tu marca. Un detalle que tus clientes notan.",
  },
  {
    title: "Distribuidores mayoristas",
    desc: "Márgenes competitivos, stock constante y embalajes listos para reventa.",
  },
  {
    title: "Jugueterías y centros recreativos",
    desc: "Pelotas duraderas, seguras y con colores que no se desvanecen.",
  },
];

const processSteps = [
  { step: "01", title: "Materia prima certificada", desc: "Polímeros vírgenes y reciclados de grado alimenticio, certificados para contacto humano seguro." },
  { step: "02", title: "Inyección de precisión", desc: "Máquinas de última generación garantizan espesor uniforme y colores homogéneos." },
  { step: "03", title: "Control de calidad", desc: "Cada lote pasa por inspección visual y pruebas de resistencia al impacto." },
  { step: "04", title: "Empaque y despacho", desc: "Bolsas selladas y embalaje profesional para que todo llegue intacto y a tiempo." },
];

const colorPalette = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f43f5e", "#14b8a6", "#f59e0b", "#6366f1",
];

const specs = [
  { label: "Material", value: "Polietileno de alta densidad (PEAD)" },
  { label: "Uso", value: "Grado alimenticio / Contacto humano" },
  { label: "Pelotas Ø", value: "40 mm · 60 mm · 80 mm" },
  { label: "Pajillas", value: "Normal · Jumbo · Smoothie" },
  { label: "Colores", value: "12 en stock · 50+ bajo pedido" },
  { label: "Pago en línea", value: "Tarjeta de crédito/débito vía Wompi" },
];

export default function BeneficiosPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-medium text-primary">Más que un proveedor, un aliado</p>
              <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
                Fabricamos color. <br />
                <span className="text-primary">Vos vendés alegría.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                Desde la materia prima hasta la entrega en tu puerta, controlamos cada paso
                para que vos te enfoques en lo que mejor sabés hacer.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/productos" className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90">
                  Ver catálogo
                </Link>
                <Link to="/contacto" className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary">
                  Cotización mayorista
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl shadow-primary/10">
              <img src={heroBalls} alt="Pelotas plásticas de colores vibrantes" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <dl className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
            {stats.map(([value, label]) => (
              <div key={label} className="text-center">
                <dt className="font-display text-3xl font-bold text-foreground">{value}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Hecho para tu negocio</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              ¿Para qué usan Industrias Charly nuestros clientes?
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {useCases.map((uc) => (
              <div key={uc.title} className="rounded-2xl border border-border bg-card p-8 transition hover:border-primary/40">
                <h3 className="font-display text-2xl font-semibold">{uc.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">Proceso de fabricación</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
                De la resina al producto final.
              </h2>
              <div className="mt-12 space-y-10">
                {processSteps.map((s, i) => (
                  <div key={s.step} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                        {s.step}
                      </div>
                      {i < processSteps.length - 1 && <div className="mt-2 h-full w-px bg-border" />}
                    </div>
                    <div className="pb-2">
                      <h4 className="font-display text-lg font-semibold">{s.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-border shadow-2xl shadow-primary/10">
              <img src={ballCloseup} alt="Detalle de calidad de pelota plástica" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-primary">Colores infinitos</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Tu marca tiene un color. Nosotros lo fabricamos.
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {colorPalette.map((c) => (
              <div key={c} className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 rounded-2xl shadow-sm transition hover:scale-110" style={{ backgroundColor: c }} />
                <span className="text-[10px] font-mono uppercase text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-secondary/20">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-primary">Especificaciones técnicas</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
                Calidad que se puede medir.
              </h2>
              <div className="mt-10 grid grid-cols-2 gap-4">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className="mt-1 font-display text-sm font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-border shadow-xl">
              <img src={straws} alt="Detalle de calidad de pajillas plásticas" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            ¿Listo para llevar color a tu negocio?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-background/70">
            Compra en línea con pago seguro, o solicita una cotización mayorista.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link to="/productos" className="inline-flex items-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              Comprar ahora
            </Link>
            <Link to="/contacto" className="inline-flex items-center rounded-full border border-background/20 bg-background/5 px-8 py-3 text-sm font-semibold text-background transition hover:bg-background/10">
              Hablar con ventas
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
