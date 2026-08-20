import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

  const addItem = (product, options = {}) => {
    const { color, size, quantity } = options;
    const qty = quantity || product.minOrderQuantity || 1;

    setItems((prev) => {
      const key = lineKey({ productId: product._id, color, size });
      const existing = prev.find((i) => lineKey(i) === key);

      if (existing) {
        return prev.map((i) =>
          lineKey(i) === key ? { ...i, quantity: i.quantity + qty } : i,
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
  };

  const updateQuantity = (item, quantity) => {
    setItems((prev) =>
      prev.map((i) =>
        lineKey(i) === lineKey(item)
          ? { ...i, quantity: Math.max(i.minOrderQuantity || 1, quantity) }
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
