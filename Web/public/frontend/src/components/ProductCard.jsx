import { Link } from "react-router-dom";
import { PRODUCT_COLOR_HEX } from "../lib/catalogOptions";

export default function ProductCard({ product }) {
  const image = product.images?.[0]?.url;

  return (
    <Link
      to={`/productos/${product.slug}`}
      className="group overflow-hidden rounded-3xl border border-border bg-card transition hover:shadow-xl hover:shadow-primary/10"
    >
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
        {product.colors?.length ? (
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
        <div className="mt-4 flex items-center justify-between">
          <span className="font-display text-lg font-bold">
            ${product.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">c/u</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Mín. {product.minOrderQuantity}u
          </span>
        </div>
      </div>
    </Link>
  );
}
