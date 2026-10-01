import { useRef } from "react";
import StatusPill from "../ui/StatusPill";
import ColorSwatch from "../ui/ColorSwatch";
import Button from "../ui/Button";
import ActionsMenu from "../ui/ActionsMenu";
import { PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";
import { buttonClass } from "../../lib/buttonStyles";
import { fmtMoney, fmtNumber } from "../../lib/format";
import { IconImage, IconUpload } from "../../lib/icons";

/*
  Tarjeta de un producto del catálogo público (pantalla Catálogo). Imagen de
  128px (o placeholder con el color principal suavizado), categoría y estado,
  nombre, mínimo y stock, precio, colores y acciones: Editar, subir imagen
  (directo, sin abrir el modal) y «…» con Eliminar.
*/

// Estado en la tienda: Inactivo si no se muestra; si se muestra, Destacado o Activo.
function catalogStatus(product) {
  if (product.active === false) return "Inactivo";
  return product.featured ? "Destacado" : "Activo";
}

// Fondo suave del color principal del producto (color físico, no del tema).
function placeholderStyle(product) {
  const hex = PRODUCT_COLOR_HEX[product.colors?.[0]];
  return hex ? { backgroundColor: `color-mix(in srgb, ${hex} 16%, var(--color-surface))` } : undefined;
}

function ProductCatalogCard({ product, onEdit, onDelete, onAddImages, uploading }) {
  const fileInputRef = useRef(null);
  const image = product.images?.[0]?.url;
  const colors = product.colors || [];

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddImages(product, files);
    e.target.value = ""; // permite volver a elegir el mismo archivo después
  }

  return (
    <div className="flex flex-col rounded-[14px] border border-line bg-surface">
      <div className="relative h-[128px] overflow-hidden rounded-t-[14px] bg-surface-2" style={image ? undefined : placeholderStyle(product)}>
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <IconImage width={26} height={26} />
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 inline-flex h-[22px] items-center rounded-[7px] bg-surface px-2 text-[11px] font-semibold text-ink-2 shadow-soft">
          {product.category || "—"}
        </span>
        <span className="absolute right-2.5 top-2.5">
          <StatusPill status={catalogStatus(product)} domain="catalogo" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[15px] font-bold text-ink" title={product.name}>{product.name}</p>
        <p className="mt-0.5 text-[11.5px] text-subtle">
          Mínimo {fmtNumber(product.minOrderQuantity ?? 1)} u · stock {fmtNumber(product.stock)}
        </p>

        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-[19px] font-semibold tabular-nums text-ink">{fmtMoney(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-[12px] tabular-nums text-subtle line-through">{fmtMoney(product.compareAtPrice)}</span>
          ) : null}
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          {colors.length ? (
            <>
              <span className="flex flex-wrap gap-1">
                {colors.map((c) => (
                  <span key={c} title={c}>
                    <ColorSwatch color={c} size={15} />
                  </span>
                ))}
              </span>
              <span className="t-aux">
                {colors.length} {colors.length === 1 ? "color" : "colores"}
              </span>
            </>
          ) : (
            <span className="t-aux">Sin colores</span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Button variant="secondary" size="row" className="!h-8 flex-1" onClick={() => onEdit(product)}>
            Editar
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label={uploading ? "Subiendo imagen…" : "Subir imagen"}
            title={uploading ? "Subiendo imagen…" : "Subir imagen"}
            className={`${buttonClass("secondary", "row")} !h-8 w-8 !px-0`}
          >
            <IconUpload width={15} height={15} className={uploading ? "animate-pulse" : ""} />
          </button>
          <ActionsMenu size="card" items={[{ label: "Eliminar", onClick: () => onDelete(product), danger: true }]} />
        </div>
      </div>
    </div>
  );
}

export default ProductCatalogCard;
