import { useState } from "react";
import { SelectField } from "./Field";
import { SUBCATEGORY_CATEGORIES, categoryOfProduct, productOptions, useSubcategories } from "../../hooks/useSubcategories";

/*
  Elección del producto en dos pasos: «Categoría» (Pajillas/Pelotas) y
  «Producto» (las subcategorías activas de esa categoría). El valor guardado
  es el nombre de la subcategoría. Son dos campos (un fragmento): el
  formulario los acomoda en su cuadrícula.
    <ProductSelect value={form.product} onChange={handleChange} />
  - onChange recibe { target: { name, value } } como el resto de SelectField.
  - Al cambiar de categoría el producto se limpia.
  - Al editar, la categoría se deduce del producto guardado, que se muestra
    aunque su subcategoría esté inactiva (o sea anterior a las subcategorías).
  - Sin valor inicial: no hay producto por defecto. Quien guarda debe validar
    que el producto no esté vacío.
  El componente se monta con el formulario; si el formulario se reutiliza sin
  cerrarse (p. ej. al agregar otra línea), cambia su `key` para reiniciarlo.
*/
function ProductSelect({ name = "product", value, onChange, size = "md", required = true }) {
  const { all } = useSubcategories();
  // Categoría elegida a mano; mientras no se elija, sale del producto guardado.
  const [picked, setPicked] = useState(null);
  const category = picked ?? categoryOfProduct(all, value);
  const options = productOptions(all, category, value);

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
        options={SUBCATEGORY_CATEGORIES}
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
