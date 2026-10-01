import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useCart } from "../context/CartContext";
import { PRODUCT_COLOR_HEX } from "../lib/catalogOptions";

// Disponibilidad según product.stock, con los colores de estado que ya usa el
// sitio: verde de éxito (Entregado en Mis pedidos, Pago confirmado), ámbar de
// advertencia (En Fabricación, Pago pendiente) y el rojo de error de Field.
const LOW_STOCK_MAX = 10;
function availability(stock = 0) {
  if (stock <= 0) return { label: "Agotado", tone: "text-red-600" };
  if (stock <= LOW_STOCK_MAX) return { label: "Stock bajo", tone: "text-amber-700" };
  return { label: "Disponible", tone: "text-green-700" };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Íconos de trazo, mismo estilo que los del Navbar.
const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};
const ColorsIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="9" r="5" />
    <circle cx="15" cy="15" r="5" />
  </svg>
);
const SizesIcon = () => (
  <svg {...iconProps}>
    <path d="M3 17l14-14 4 4L7 21z" />
    <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
  </svg>
);

/*
  Tarjeta del catálogo. El <Link> cubre toda la tarjeta; la insignia y el
  botón «Agregar» van en una capa aparte encima de la imagen (hermana del
  Link, no dentro): así el botón no queda anidado en el enlace y su clic no
  navega al detalle.
*/
export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const image = product.images?.[0]?.url;
  const colorsCount = product.colors?.length || 0;
  const sizesCount = product.sizes?.length || 0;
  const stock = availability(product.stock);
  const soldOut = (product.stock ?? 0) <= 0;

  // Misma selección inicial que ProductoDetallePage: primer color, primer
  // tamaño y la cantidad mínima.
  const handleQuickAdd = () => {
    addItem(product, {
      color: product.colors?.[0] || "",
      size: product.sizes?.[0] || "",
      quantity: product.minOrderQuantity || 1,
    });
    toast.success(`${product.name} agregado al carrito`);
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-card transition hover:shadow-xl hover:shadow-primary/10">
      <Link to={`/productos/${product.slug}`} className="block">
        <div className="aspect-square overflow-hidden bg-secondary">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold">{product.name}</h3>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {product.category}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
          {colorsCount || sizesCount ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {colorsCount ? (
                <span className="inline-flex items-center gap-1.5">
                  <ColorsIcon />
                  {plural(colorsCount, "color", "colores")}
                </span>
              ) : null}
              {sizesCount ? (
                <span className="inline-flex items-center gap-1.5">
                  <SizesIcon />
                  {plural(sizesCount, "tamaño", "tamaños")}
                </span>
              ) : null}
            </div>
          ) : null}
          {colorsCount ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.colors.map((c) => (
                <span
                  key={c}
                  title={c}
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-foreground/10"
                  style={{ backgroundColor: PRODUCT_COLOR_HEX[c] || "#cbd5e1" }}
                />
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-display text-lg font-bold">
                ${product.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">c/u</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${stock.tone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {stock.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Mín. {product.minOrderQuantity}u
            </span>
          </div>
        </div>
      </Link>

      {/* Capa sobre la imagen: misma área cuadrada que la foto. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        {product.featured === true && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            Destacado
          </span>
        )}
        {/* Siempre visible en pantallas táctiles; con mouse, al pasar el
            cursor por la tarjeta o al enfocar el botón con el teclado. */}
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={soldOut}
          title={soldOut ? "Producto agotado" : `Agregar ${product.minOrderQuantity || 1}u al carrito`}
          className="pointer-events-auto absolute bottom-3 right-3 inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:disabled:opacity-60"
        >
          {soldOut ? "Agotado" : "Agregar"}
        </button>
      </div>
    </div>
  );
}
