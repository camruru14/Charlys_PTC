import { Link } from "react-router-dom";
import Stat from "../components/Stat";
import ProductCard from "../components/ProductCard";
import useFetch from "../hooks/useFetch";
import heroBalls from "../assets/hero-balls.jpeg";

export default function InicioPage() {
  const { data: featured, loading: loadingFeatured } = useFetch("/products?featured=true");
  const hasFeatured = Array.isArray(featured) && featured.length > 0;

  // "Destacado" es opcional en el formulario de Catálogo (ver
  // ProductFormModal.jsx): si nadie marcó ninguno todavía, Inicio no debe
  // quedar vacío — muestra el resto del catálogo real en su lugar.
  const needsFallback = !loadingFeatured && !hasFeatured;
  const { data: allProducts, loading: loadingAll } = useFetch(
    needsFallback ? "/products" : null,
    [needsFallback],
  );

  const shownProducts = hasFeatured ? featured : allProducts;
  const loading = loadingFeatured || (needsFallback && loadingAll);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-16 md:grid-cols-2 md:items-center md:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Venta al por mayor
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Color que se <span className="text-primary">mueve</span>.
              Plástico que <span className="italic">rinde</span>.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Pelotas y pajillas plásticas de alta calidad para eventos, negocios y
              distribuidores. Colores vivos, precios justos, compra en línea con pago
              seguro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/productos"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
              >
                Ver catálogo
              </Link>
              <Link
                to="/contacto"
                className="inline-flex items-center rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
              >
                Cotización mayorista
              </Link>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-8">
              {[
                ["+15", "años en el mercado"],
                ["24 h", "despacho promedio"],
                ["50+", "colores disponibles"],
              ].map(([k, v]) => (
                <div key={v}>
                  <dt className="font-display text-2xl font-bold text-foreground">{k}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl shadow-primary/10">
              <img
                src={heroBalls}
                alt="Pelotas plásticas de colores"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Productos destacados (reales, desde la API) */}
      <section id="productos" className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-primary">Nuestros productos</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
                Dos categorías. Cero complicaciones.
              </h2>
            </div>
            <Link to="/productos" className="text-sm font-medium text-primary hover:underline">
              Ver todo el catálogo →
            </Link>
          </div>

          {loading && <p className="mt-12 text-muted-foreground">Cargando productos…</p>}

          {!loading && (!shownProducts || shownProducts.length === 0) && (
            <p className="mt-12 text-muted-foreground">
              Todavía no hay productos publicados. Agrégalos desde Catálogo en el panel de
              administración.
            </p>
          )}

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shownProducts?.slice(0, 4).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Beneficios resumidos */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <p className="text-sm font-medium text-primary">Por qué Industrias Charly</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
            El proveedor confiable para tu negocio.
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { t: "Precio mayorista", d: "Escala tus márgenes con tarifas por volumen." },
              { t: "Stock permanente", d: "Producción continua, sin quiebres de inventario." },
              { t: "Pago en línea seguro", d: "Checkout con Wompi: tarjeta de crédito o débito." },
            ].map((f, i) => (
              <div key={f.t} className="rounded-2xl border border-border bg-card p-8 transition hover:border-primary/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold">{f.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
          <Link
            to="/beneficios"
            className="mt-10 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Ver todos los beneficios →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium text-primary">Promoción del mes</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              10% OFF en tu primer pedido mayorista.
            </h2>
            <p className="mt-4 max-w-md text-background/70">
              Crea tu cuenta, agrega productos al carrito y paga en línea con tarjeta.
            </p>
          </div>
          <div className="rounded-3xl border border-background/10 bg-background/5 p-8 backdrop-blur">
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="Entrega" value="24–72 h" />
              <Stat label="Colores" value="50+" />
              <Stat label="Formatos" value="6" />
              <Stat label="Pago" value="En línea" />
            </div>
            <Link
              to="/productos"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Comprar ahora
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
