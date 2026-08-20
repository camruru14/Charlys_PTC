import { useRef, useState } from "react";
import Modal from "../ui/Modal";
import { Field, SelectField, TextareaField } from "../ui/Field";
import { blockNegativeKey } from "../../lib/numberInput";
import { PRODUCT_COLORS, PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";
import { IconClose } from "../../lib/icons";

const CATEGORIES = ["Pelotas", "Pajillas"];

/*
  Modal de creación/edición de un producto del catálogo público. El nombre se
  escribe a mano (no todos los productos futuros calzan en una lista fija) y
  la categoría se elige de un dropdown. Los colores sí salen de
  catalogOptions.js (misma fuente que usa public/frontend), así ambos lados
  nunca se desincronizan ahí.

  Las imágenes existentes (solo en edición) se pueden quitar una por una;
  agregar imágenes nuevas —al crear o después— se sube junto con el resto del
  formulario al guardar (ver handleSubmit en pages/Catalogo.jsx). Para
  agregarle una imagen a un producto ya existente SIN abrir este modal, está
  el botón "Agregar imagen" de cada card (ProductCatalogCard.jsx).
*/
function ProductFormModal({ open, onClose, editingId, form, handleChange, onToggleColor, onSubmit, saving, onRemoveImage, removingImage }) {
  const fileInputRef = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  function handleFilesSelected(e) {
    setPendingFiles(Array.from(e.target.files || []));
  }

  function handleClose() {
    setPendingFiles([]);
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(pendingFiles).then(() => setPendingFiles([]));
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingId ? "Editar producto" : "Nuevo producto"}
      size="lg"
      footer={
        <>
          <button onClick={handleClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" form="product-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="name" value={form.name} onChange={handleChange} placeholder="Ej. Pelota plástica 40 mm" required />
        <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} required />

        <div className="sm:col-span-2">
          <TextareaField label="Descripción" name="description" value={form.description} onChange={handleChange} rows={3} />
        </div>

        <Field label="Precio ($)" name="price" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.price} onChange={handleChange} required />
        <Field label="Precio antes ($) — opcional" name="compareAtPrice" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.compareAtPrice} onChange={handleChange} placeholder="Sin descuento" />
        <Field label="Cantidad mínima de pedido" name="minOrderQuantity" type="number" min="1" onKeyDown={blockNegativeKey} value={form.minOrderQuantity} onChange={handleChange} />
        <Field label="Existencia mostrada en la tienda" name="stock" type="number" min="0" onKeyDown={blockNegativeKey} value={form.stock} onChange={handleChange} />

        {/* Colores: checkboxes de catalogOptions.js, con puntito de color */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Colores</span>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_COLORS.map((color) => {
              const checked = form.colors.includes(color);
              return (
                <label
                  key={color}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    checked ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => onToggleColor(color)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-slate-900/10" style={{ backgroundColor: PRODUCT_COLOR_HEX[color] }} />
                  {color}
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
          Destacado (aparece en Inicio)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="active" checked={form.active} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400" />
          Visible en la tienda
        </label>

        {/* Imágenes existentes: solo aparecen editando un producto ya creado */}
        {editingId && form.images?.length ? (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Imágenes actuales</span>
            <div className="flex flex-wrap gap-3">
              {form.images.map((img) => (
                <div key={img.publicId} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.publicId)}
                    disabled={removingImage === img.publicId}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
                    title="Quitar imagen"
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Imágenes nuevas: se suben al guardar (crear o editar) */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {editingId ? "Agregar imágenes" : "Imágenes (opcional)"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-600 hover:file:bg-slate-200"
          />
          {pendingFiles.length ? (
            <p className="mt-1.5 text-xs text-slate-500">{pendingFiles.length} imagen(es) lista(s) para subir al guardar.</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

export default ProductFormModal;
