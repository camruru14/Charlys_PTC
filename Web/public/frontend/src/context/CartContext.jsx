import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { MAX_QUANTITY } from "../lib/quantity";

const CartContext = createContext(null);
const STORAGE_KEY = "charly-tienda:carrito";

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Un item de carrito: { productId, slug, name, image, price, color, size,
// minOrderQuantity, quantity, stock }. Lo guardado en el navegador puede quedar viejo:
// syncWithCatalog() lo refresca desde el backend al abrir el carrito o el checkout.
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);

  // Copia para leer los items actuales dentro de funciones async.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const lineKey = (item) => `${item.productId}::${item.color || ""}::${item.size || ""}`;

  // Devuelve true si la suma superó el máximo y la línea quedó en MAX_QUANTITY
  // (ya avisó con toast.error); así quien llama no muestra además «agregado».
  const addItem = (product, options = {}) => {
    const { color, size, quantity } = options;
    const qty = quantity || product.minOrderQuantity || 1;

    const key = lineKey({ productId: product._id, color, size });
    const existingNow = items.find((i) => lineKey(i) === key);
    const capped = Boolean(existingNow) && existingNow.quantity + qty > MAX_QUANTITY;
    if (capped) toast.error("La cantidad máxima por producto es 9,999,999");

    setItems((prev) => {
      const existing = prev.find((i) => lineKey(i) === key);

      if (existing) {
        return prev.map((i) =>
          lineKey(i) === key ? { ...i, quantity: Math.min(MAX_QUANTITY, i.quantity + qty) } : i,
        );
      }

      return [
        ...prev,
        {
          productId: product._id,
          slug: product.slug,
          name: product.name,
          image: product.images?.[0]?.url,
          price: product.price,
          minOrderQuantity: product.minOrderQuantity || 1,
          stock: product.stock,
          color,
          size,
          quantity: qty,
        },
      ];
    });

    return capped;
  };

  // Seguridad: el resultado siempre queda en [minOrderQuantity, MAX_QUANTITY].
  const updateQuantity = (item, quantity) => {
    if (!Number.isFinite(quantity)) return;
    setItems((prev) =>
      prev.map((i) =>
        lineKey(i) === lineKey(item)
          ? { ...i, quantity: Math.min(MAX_QUANTITY, Math.max(i.minOrderQuantity || 1, quantity)) }
          : i,
      ),
    );
  };

  const removeItem = (item) => {
    setItems((prev) => prev.filter((i) => lineKey(i) !== lineKey(item)));
  };

  const clearCart = () => setItems([]);

  // Refresca precio, nombre, imagen, mínimo y disponibilidad de los productos del carrito
  // con lo que hay hoy en el catálogo (GET /products, solo productos activos), y quita los
  // que ya no existen (o están inactivos), pero NO los que tienen stock 0: esos se venden bajo pedido.
  // Avisa de lo que cambió. Un fallo de red deja el carrito como estaba.
  const syncWithCatalog = async () => {
    const current = itemsRef.current;
    if (current.length === 0) return;
    let catalog;
    try {
      catalog = await api.get("/products");
    } catch {
      return;
    }
    if (!Array.isArray(catalog)) return;
    const byId = new Map(catalog.map((p) => [String(p._id), p]));

    const removed = [];
    let priceChanged = false;
    const next = [];
    for (const item of itemsRef.current) {
      const product = byId.get(String(item.productId));
      if (!product) {
        removed.push(item.name);
        continue;
      }
      if (product.price !== item.price) priceChanged = true;
      const minOrderQuantity = product.minOrderQuantity || 1;
      next.push({
        ...item,
        slug: product.slug,
        name: product.name,
        image: product.images?.[0]?.url,
        price: product.price,
        minOrderQuantity,
        stock: product.stock,
        quantity: Math.max(minOrderQuantity, item.quantity),
      });
    }
    setItems(next);
    removed.forEach((name) => toast.error(`"${name}" ya no está disponible y se quitó de tu carrito.`));
    if (priceChanged) toast("Actualizamos algunos precios de tu carrito.", { icon: "ℹ️" });
  };

  // Precios nuevos que respondió el checkout (409, [{ id, price }]): se aplican al carrito.
  const applyPrices = (products) => {
    if (!Array.isArray(products)) return;
    const byId = new Map(products.map((p) => [String(p.id), p.price]));
    setItems((prev) => prev.map((i) => (byId.has(String(i.productId)) ? { ...i, price: byId.get(String(i.productId)) } : i)));
  };

  // Hay un producto del carrito sin existencias (según el último refresco): se fabrica bajo pedido.
  // Solo informativo: no bloquea el carrito ni el pago.
  const hasMadeToOrder = items.some((i) => i.stock != null && i.stock <= 0);

  // Igual que el backend: cada subtotal se redondea a centavos y se suma en centavos enteros
  // (con precios de hasta 2 decimales, price × cantidad ya es un número exacto de centavos).
  const total = useMemo(
    () => items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0) / 100,
    [items],
  );

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clearCart, syncWithCatalog, applyPrices, hasMadeToOrder, total, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

export default CartContext;
