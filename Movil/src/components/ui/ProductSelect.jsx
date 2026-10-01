import { useState } from "react";
import SegmentedField from "./SegmentedField";
import SelectField from "./SelectField";
import { SUBCATEGORY_CATEGORIES, categoryOfProduct, productOptions, useSubcategories } from "../../hooks/useSubcategories";

// Elección del producto en dos pasos (ProductSelect.jsx de la web):
// «Categoría» (Pajillas/Pelotas) y «Producto» (las subcategorías activas de esa
// categoría). El valor es el nombre de la subcategoría.
//   <ProductSelect value={form.product} onChange={(v) => handleChange("product", v)} />
// - Al cambiar de categoría el producto se limpia.
// - Al editar, la categoría se deduce del producto guardado, que se muestra
//   aunque su subcategoría esté inactiva (o sea anterior a las subcategorías).
// - Sin valor por defecto: quien guarda debe validar que el producto no esté
//   vacío. Si el formulario se reutiliza sin cerrarse (p. ej. al agregar otra
//   línea de un pedido), cambia su `key` para reiniciarlo.
export default function ProductSelect({ value, onChange, required = true }) {
  const { all } = useSubcategories();
  // Categoría elegida a mano; mientras no se elija, sale del producto guardado.
  const [picked, setPicked] = useState(null);
  const category = picked ?? categoryOfProduct(all, value);
  const options = productOptions(all, category, value);

  const changeCategory = (next) => {
    setPicked(next);
    if (next !== category) onChange("");
  };

  return (
    <>
      <SegmentedField label="Categoría" value={category} options={SUBCATEGORY_CATEGORIES} onChange={changeCategory} required={required} />
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
