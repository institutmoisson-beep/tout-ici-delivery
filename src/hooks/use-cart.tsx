import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface CartItem {
  dishId: string;
  restaurantId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  instructions: string[];
  customNote?: string;
}

interface CartCtx {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: CartItem) => void;
  updateQty: (dishId: string, qty: number) => void;
  removeItem: (dishId: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
}

const CartContext = createContext<CartCtx | null>(null);
const STORAGE_KEY = "toutici_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const restaurantId = items[0]?.restaurantId ?? null;

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      // enforce single-restaurant cart
      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        return [item];
      }
      return [...prev, item];
    });
  };

  const updateQty = (dishId: string, qty: number) => {
    if (qty <= 0) return removeItem(dishId);
    setItems((prev) => prev.map((i) => (i.dishId === dishId ? { ...i, quantity: qty } : i)));
  };
  const removeItem = (dishId: string) =>
    setItems((prev) => prev.filter((i) => i.dishId !== dishId));
  const clear = () => setItems([]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, restaurantId, addItem, updateQty, removeItem, clear, subtotal, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be within CartProvider");
  return ctx;
}