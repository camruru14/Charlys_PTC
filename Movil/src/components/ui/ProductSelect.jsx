import { useState } from "react";
import SegmentedField from "./SegmentedField";
import SelectField from "./SelectField";
import { PRODUCT_NAME_CATEGORIES, categoryOfProduct, productOptions, useProductNames } from "../../hooks/useProductNames";

// Elección del producto en dos pasos (ProductSelect.jsx de la web):
// «Categoría» (Pajillas/Pelotas) y «Producto» (todos los productos del Catálogo
// de esa categoría, activos o no). El valor es el nombre del producto.
//   <ProductSelect value={form.product} onChange={(v) => handleChange("product", v)} />
// - Al cambiar de categoría el producto se limpia.
// - Al editar, la categoría se deduce del producto guardado, que se muestra
//   aunque ya no exista en el Catálogo (o sea anterior al Catálogo único).
// - Sin valor por defecto: quien guarda debe validar que el producto no esté
//   vacío. Si el formulario se reutiliza sin cerrarse (p. ej. al agregar otra
//   línea de un pedido), cambia su `key` para reiniciarlo.
export default function ProductSelect({ value, onChange, required = true }) {
  const { products } = useProductNames();
  // Categoría elegida a mano; mientras no se elija, sale del producto guardado.
  const [picked, setPicked] = useState(null);
  const category = picked ?? categoryOfProduct(products, value);
  const options = productOptions(products, category, value);

  const changeCategory = (next) => {
    setPicked(next);
    if (next !== category) onChange("");
  };

  return (
    <>
      <SegmentedField label="Categoría" value={category} options={PRODUCT_NAME_CATEGORIES} onChange={changeCategory} required={required} />
      <SelectField
        label="Producto"
        title="Producto"
        value={value}
        options={options.map((n) => ({ label: n, value: n }))}
        onChange={onChange}
        placeholder={!category ? "Elige la categoría" : options.length ? "Seleccionar" : "Sin productos"}
        required={required}
      />
    </>
  );
}
