import { useRef } from "react";
import StatusPill from "../ui/StatusPill";
import { PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";
import { IconImage } from "../../lib/icons";

/*
  Card de un producto del catálogo público, para la pantalla Catálogo
  (private/frontend). Muestra imagen, nombre, categoría, precio y colores;
  "Agregar imagen" sube directo sin pasar por el modal de editar (subida
  rápida a la card ya existente, ver useCatalogImages en pages/Catalogo.jsx).
*/
function ProductCatalogCard({ product, onEdit, onDelete, onAddImages, uploading }) {
  const fileInputRef = useRef(null);
  const image = product.images?.[0]?.url;
  const extraImages = (product.images?.length || 0) - 1;

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddImages(product, files);
    e.target.value = ""; // permite volver a elegir el mismo archivo después
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-square bg-slate-100">
        {image ? (
          <img src={image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
            <IconImage width={28} height={28} />
            <span className="text-xs font-medium">Sin imagen</span>
          </div>
        )}
        {extraImages > 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-semibold text-white">
            +{extraImages}
          </span>
        ) : null}
        {product.active === false ? (
          <span className="absolute left-2 top-2">
            <StatusPill status="Inactivo" />
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800">{product.name}</p>
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {product.category}
            </span>
          </div>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900">${Number(product.price).toFixed(2)}</span>
            {product.compareAtPrice ? (
              <span className="text-xs text-slate-400 line-through">${Number(product.compareAtPrice).toFixed(2)}</span>
            ) : null}
          </p>
        </div>

        {product.colors?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {product.colors.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-slate-900/10"
                  style={{ backgroundColor: PRODUCT_COLOR_HEX[c] || "#cbd5e1" }}
                />
                {c}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sin colores</p>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-semibold">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200 disabled:opacity-60"
          >
            {uploading ? "Subiendo…" : "Agregar imagen"}
          </button>
          <button onClick={() => onEdit(product)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">
            Editar
          </button>
          <button onClick={() => onDelete(product)} className="ml-auto rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCatalogCard;
