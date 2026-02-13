import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createOrder } from "../lib/cartApi";

const CART_COOKIE_NAME = "ac_cart";
const CART_COOKIE_MAX_AGE_DAYS = 30;

const readCartCookie = () => {
  if (typeof document === "undefined") return [];
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CART_COOKIE_NAME}=`));
  if (!match) return [];
  try {
    const raw = decodeURIComponent(match.split("=")[1] || "");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.productId && Number(item.quantity) > 0)
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name || "",
        price_inr: Number(item.price_inr) || 0,
        quantity: Number(item.quantity) || 1,
      }));
  } catch {
    return [];
  }
};

const writeCartCookie = (items) => {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * CART_COOKIE_MAX_AGE_DAYS;
  const payload = encodeURIComponent(JSON.stringify(items));
  document.cookie = `${CART_COOKIE_NAME}=${payload}; path=/; max-age=${maxAge}; samesite=lax`;
};

const CartContext = createContext(undefined);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { productId, name, price_inr, quantity }
  const [couponCode, setCouponCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");

  useEffect(() => {
    setItems(readCartCookie());
  }, []);

  useEffect(() => {
    writeCartCookie(items);
  }, [items]);

  const addToCart = async (product, quantity = 1) => {
    if (!product || !product.id) return;

    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          id: undefined,
          productId: product.id,
          name: product.name,
          price_inr: product.price_inr,
          quantity,
        },
      ];
    });

  };

  const removeFromCart = async (productId) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateQuantity = async (productId, quantity) => {
    const safeQty = Math.max(1, Number(quantity) || 1);
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: safeQty } : item
      )
    );
  };

  const clearCart = async () => {
    setItems([]);
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (Number(item.price_inr) || 0) * item.quantity,
        0
      ),
    [items]
  );

  // Simple, demonstrative discount logic only
  const discount = useMemo(() => {
    let value = 0;
    if (couponCode.trim().toUpperCase() === "GLOW10") {
      value += subtotal * 0.1;
    }
    if (giftCardCode.trim()) {
      // Support dynamic gift card amounts: pattern gift-card-<amount>
      const match = giftCardCode.match(/GIFT-CARD-(\d+)/i);
      if (match) {
        value += Number(match[1]);
      }
    }
    return Math.min(value, subtotal);
  }, [couponCode, giftCardCode, subtotal]);

  const discountedTotal = Math.max(0, subtotal - discount);

  const value = {
    items,
    couponCode,
    giftCardCode,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setCouponCode,
    setGiftCardCode,
    clearCouponCode: () => setCouponCode(""),
    clearGiftCardCode: () => setGiftCardCode(""),
    subtotal,
    discountedTotal,
    discount,
    checkout: async (customerDetails = {}) => {
      if (!items.length || discountedTotal <= 0) return null;
      const order = await createOrder(discountedTotal, items, customerDetails);
      // DO NOT clear cart here - clear it after payment verification
      return order;
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
