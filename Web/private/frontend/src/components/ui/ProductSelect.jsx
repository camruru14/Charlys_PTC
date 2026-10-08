import { useState } from "react";
import { SelectField } from "./Field";
import { PRODUCT_CATEGORIES, categoryOfProduct, productOptions, useProductNames } from "../../hooks/useProductNames";

/*
  Elección del producto en dos pasos: «Categoría» (Pajillas/Pelotas) y
  «Producto» (todos los productos del Catálogo de esa categoría, activos o
  no). El valor guardado es el nombre del producto. Son dos campos (un fragmento): el
  formulario los acomoda en su cuadrícula.
    <ProductSelect value={form.product} onChange={handleChange} />
  - onChange recibe { target: { name, value } } como el resto de SelectField.
  - Al cambiar de categoría el producto se limpia.
  - Al editar, la categoría se deduce del producto guardado, que se muestra
    aunque ya no exista en el Catálogo (o sea anterior al Catálogo único).
  - Sin valor inicial: no hay producto por defecto. Quien guarda debe validar
    que el producto no esté vacío.
  El componente se monta con el formulario; si el formulario se reutiliza sin
  cerrarse (p. ej. al agregar otra línea), cambia su `key` para reiniciarlo.
*/
function ProductSelect({ name = "product", value, onChange, size = "md", required = true }) {
  const { products } = useProductNames();
  // Categoría elegida a mano; mientras no se elija, sale del producto guardado.
  const [picked, setPicked] = useState(null);
  const category = picked ?? categoryOfProduct(products, value);
  const options = productOptions(products, category, value);

  function changeCategory(e) {
    setPicked(e.target.value);
    if (e.target.value !== category) onChange({ target: { name, value: "" } });
  }

  return (
    <>
      <SelectField
        size={size}
        label="Categoría"
        name={`${name}Category`}
        value={category}
        onChange={changeCategory}
        options={PRODUCT_CATEGORIES}
        placeholder="Selecciona…"
        required={required}
      />
      <SelectField
        size={size}
        label="Producto"
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={category && options.length === 0 ? "Sin productos" : category ? "Selecciona…" : "Elige la categoría"}
        required={required}
      />
    </>
  );
}

export default ProductSelect;
