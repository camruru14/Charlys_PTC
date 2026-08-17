import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useFetch from "../hooks/useFetch";
import { useCart } from "../context/CartContext";
import { PRODUCT_COLOR_HEX } from "../lib/catalogOptions";

export default function ProductoDetallePage() {
  const { slug } = useParams();
  const { data: product, loading, error } = useFetch(`/products/${slug}`, [slug]);
  const { addItem } = useCart();

  const [activeImage, setActiveImage] = useState(0);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    setColor(product.colors?.[0] || "");
    setSize(product.sizes?.[0] || "");
    setQuantity(product.minOrderQuantity || 1);
    setActiveImage(0);
  }, [product]);

  if (loading) {
    return <p className="mx-auto max-w-7xl px-6 py-24 text-muted-foreground">Cargando…</p>;
  }

  if (error || !product) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Producto no encontrado</h1>
        <Link to="/productos" className="mt-6 inline-block text-primary hover:underline">
          Volver al catálogo
        </Link>
      </section>
    );
  }

  const handleAddToCart = () => {
    addItem(product, { color, size, quantity });
    toast.success(`${product.name} agregado al carrito`);
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl border border-border bg-secondary">
            {product.images?.[activeImage] ? (
              <img
                src={product.images[activeImage].url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Sin imagen
              </div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="mt-4 flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img.publicId}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`h-20 w-20 overflow-hidden rounded-xl border ${
                    i === activeImage ? "border-primary" : "border-border"
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {product.category}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-muted-foreground">{product.description}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold">${product.price.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">por unidad</span>
          </div>

          <div className="mt-8 space-y-6">
            {product.colors?.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Color
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                        color === c
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full ring-1 ring-inset ring-foreground/10"
                        style={{ backgroundColor: PRODUCT_COLOR_HEX[c] || "#cbd5e1" }}
                      />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.sizes?.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tamaño
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        size === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cantidad (mínimo {product.minOrderQuantity})
              </p>
              <input
                type="number"
                min={product.minOrderQuantity}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-2 w-32 rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={quantity < product.minOrderQuantity}
            className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Agregar al carrito — ${(product.price * quantity).toFixed(2)}
          </button>
        </div>
      </div>
    </section>
  );
}
