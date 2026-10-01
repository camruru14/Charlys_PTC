import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
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
// minOrderQuantity, quantity }
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadInitialCart);

  useEffect(() => {
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

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, removeItem, clearCart, total, count }}
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
