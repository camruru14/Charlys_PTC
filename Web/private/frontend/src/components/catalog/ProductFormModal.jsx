import { useRef, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../ui/Modal";
import { Field, SelectField, TextareaField } from "../ui/Field";
import { blockNegativeKey } from "../../lib/numberInput";
import { PRODUCT_COLORS, PRODUCT_COLOR_HEX } from "../../lib/catalogOptions";
import { IconClose } from "../../lib/icons";
import { buttonClass } from "../../lib/buttonStyles";
import { normalizeName, sameName } from "../../hooks/useProductNames";

const CATEGORIES = ["Pelotas", "Pajillas"];
const MAX_NAME_LENGTH = 60;

/*
  Modal de creación/edición de un producto del catálogo público. El
  catálogo es la única fuente de productos: se escribe el NOMBRE (obligatorio,
  máximo 60) y se elige la CATEGORÍA. Ese nombre es el «producto» que se elige
  en Fabricación, Producción diaria e Inventario y el que guardan los pedidos
  de la tienda. Es único sin distinguir mayúsculas ni espacios sobrantes: se
  valida en vivo con `productNames` (useProductNames) y, si ya existe, se
  muestra el error y no se puede guardar. Un producto que ya se usa en
  pedidos, lotes o inventario (`inUse`) no cambia de nombre ni de categoría.
  Los colores salen de catalogOptions.js (misma fuente que
  usa public/frontend), así ambos lados nunca se desincronizan ahí.

  Las imágenes existentes (solo en edición) se pueden quitar una por una;
  agregar imágenes nuevas —al crear o después— se sube junto con el resto del
  formulario al guardar (ver handleSubmit en pages/Catalogo.jsx). Para
  agregarle una imagen a un producto ya existente SIN abrir este modal, está
  el botón "Agregar imagen" de cada card (ProductCatalogCard.jsx).
*/
function ProductFormModal({ open, onClose, editingId, form, productNames = [], handleChange, onToggleColor, onSubmit, saving, onRemoveImage, removingImage }) {
  const fileInputRef = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  function handleFilesSelected(e) {
    setPendingFiles(Array.from(e.target.files || []));
  }

  function handleClose() {
    setPendingFiles([]);
    onClose();
  }

  const typedName = normalizeName(form.name);
  // El propio producto no cuenta como repetido.
  const duplicate = Boolean(typedName) && productNames.some((p) => p._id !== editingId && sameName(p.name, typedName));
  const locked = Boolean(editingId && productNames.find((p) => p._id === editingId)?.inUse);

  function handleSubmit(e) {
    e.preventDefault();
    if (!typedName) {
      toast.error("Escribe el nombre del producto");
      return;
    }
    if (duplicate) {
      toast.error(`Ya existe un producto llamado «${typedName}»`);
      return;
    }
    if (!form.category) {
      toast.error("Elige la categoría");
      return;
    }
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
          <button type="button" onClick={handleClose} className={buttonClass("secondary", "modal")}>Cancelar</button>
          <button type="submit" form="product-form" disabled={saving || duplicate} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Field
            label="Nombre del producto"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ej. Pajilla jumbo"
            maxLength={MAX_NAME_LENGTH}
            autoComplete="off"
            required
            {...(locked
              ? {
                  disabled: true,
                  className: "w-full cursor-not-allowed rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-muted outline-none",
                }
              : {})}
          />
          {duplicate ? <p className="mt-1.5 text-[12px] font-medium text-tone-rose-text">Ya existe un producto llamado «{typedName}»</p> : null}
        </div>
        <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} placeholder="Selecciona…" disabled={locked} required />
        {locked ? (
          <p className="t-aux sm:col-span-2">Ya se usa en pedidos, lotes o inventario: el nombre y la categoría no se pueden cambiar.</p>
        ) : null}

        <div className="sm:col-span-2">
          <TextareaField label="Descripción" name="description" value={form.description} onChange={handleChange} rows={3} />
        </div>

        <Field label="Precio ($)" name="price" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.price} onChange={handleChange} required />
        <Field label="Precio antes ($) — opcional" name="compareAtPrice" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.compareAtPrice} onChange={handleChange} placeholder="Sin descuento" />
        <Field label="Cantidad mínima de pedido" name="minOrderQuantity" type="number" min="1" onKeyDown={blockNegativeKey} value={form.minOrderQuantity} onChange={handleChange} />
        <Field label="Existencia mostrada en la tienda" name="stock" type="number" min="0" onKeyDown={blockNegativeKey} value={form.stock} onChange={handleChange} />

        {/* Colores: checkboxes de catalogOptions.js, con puntito de color */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Colores</span>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_COLORS.map((color) => {
              const checked = form.colors.includes(color);
              return (
                <label
                  key={color}
                  className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] transition ${
                    checked ? "border-select-bar bg-primary-soft text-primary-soft-text" : "border-line text-ink-2 hover:bg-surface-2"
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => onToggleColor(color)} className="rounded border-line accent-primary" />
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-ink/10" style={{ backgroundColor: PRODUCT_COLOR_HEX[color] }} />
                  {color}
                </label>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} className="h-4 w-4 rounded border-line accent-primary" />
          Destacado (aparece en Inicio)
        </label>
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <input type="checkbox" name="active" checked={form.active} onChange={handleChange} className="h-4 w-4 rounded border-line accent-primary" />
          Visible en la tienda
        </label>

        {/* Imágenes existentes: solo aparecen editando un producto ya creado */}
        {editingId && form.images?.length ? (
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Imágenes actuales</span>
            <div className="flex flex-wrap gap-3">
              {form.images.map((img) => (
                <div key={img.publicId} className="group relative h-20 w-20 overflow-hidden rounded-[10px] border border-line">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.publicId)}
                    disabled={removingImage === img.publicId}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-60"
                    title="Quitar imagen"
                    aria-label="Quitar imagen"
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
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
            {editingId ? "Agregar imágenes" : "Imágenes (opcional)"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="block w-full text-[13px] text-ink-2 file:mr-3 file:rounded-[8px] file:border-0 file:bg-tone-gray file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink-2 hover:file:bg-line"
          />
          {pendingFiles.length ? (
            <p className="t-aux mt-1.5">{pendingFiles.length} imagen(es) lista(s) para subir al guardar.</p>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

export default ProductFormModal;
