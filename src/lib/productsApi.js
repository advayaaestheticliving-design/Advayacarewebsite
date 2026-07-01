import productsData from "../data/products.json";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeProduct(product = {}) {
  const filterTags = Array.isArray(product.filter_tags)
    ? product.filter_tags
    : Array.isArray(product.filterTags)
      ? product.filterTags
      : [];

  const images = Array.isArray(product.images) ? product.images : [];
  const stockQuantity = Math.max(0, Math.floor(toFiniteNumber(product.stock_quantity, 100)));
  const reservedQuantity = Math.max(0, Math.floor(toFiniteNumber(product.reserved_quantity, 0)));
  const lowStockThreshold = Math.max(0, Math.floor(toFiniteNumber(product.low_stock_threshold, 5)));

  let finalPrice = toFiniteNumber(product.price_inr, 0);
  const discountPercentage = toFiniteNumber(product.discount_percentage, 0);
  const discountAmount = toFiniteNumber(product.discount_amount, 0);
  let compareAtPrice = product.compare_at_price ? toFiniteNumber(product.compare_at_price, 0) : undefined;

  if (discountPercentage > 0) {
    compareAtPrice = finalPrice;
    finalPrice = finalPrice - (finalPrice * (discountPercentage / 100));
  } else if (discountAmount > 0) {
    compareAtPrice = finalPrice;
    finalPrice = Math.max(0, finalPrice - discountAmount);
  }

  return {
    ...product,
    id: String(product.id || "").trim(),
    name: String(product.name || "").trim(),
    price_inr: Math.round(finalPrice),
    compare_at_price: compareAtPrice ? Math.round(compareAtPrice) : undefined,
    discount_percentage: discountPercentage,
    discount_amount: discountAmount,
    filter_tags: filterTags,
    filterTags,
    images,
    one_line_summary: String(product.one_line_summary || "").trim(),
    ingredients: String(product.ingredients || ""),
    benefits_brief: String(product.benefits_brief || ""),
    benefits_detail: String(product.benefits_detail || ""),
    use_cases: String(product.use_cases || ""),
    stock_quantity: stockQuantity,
    reserved_quantity: reservedQuantity,
    low_stock_threshold: lowStockThreshold,
    is_active: product.is_active !== false,
    is_best_seller: product.is_best_seller === true,
  };
}

export function getAvailableStock(product = {}) {
  const normalized = normalizeProduct(product);
  if (String(normalized.id || "").startsWith("gift-card-")) {
    return Number.POSITIVE_INFINITY;
  }

  const available = normalized.stock_quantity - normalized.reserved_quantity;
  return Math.max(0, Math.floor(available));
}

export function isProductPurchasable(product = {}) {
  const normalized = normalizeProduct(product);
  if (!normalized.is_active) {
    return false;
  }

  return getAvailableStock(normalized) > 0;
}

function getFallbackProducts() {
  return (Array.isArray(productsData) ? productsData : [])
    .map((item) => normalizeProduct(item))
    .filter((item) => Boolean(item.id));
}

const PRODUCT_SELECT_COLUMNS = [
  "id",
  "name",
  "price_inr",
  "compare_at_price",
  "discount_percentage",
  "discount_amount",
  "filter_tags",
  "images",
  "one_line_summary",
  "ingredients",
  "benefits_brief",
  "benefits_detail",
  "use_cases",
  "stock_quantity",
  "reserved_quantity",
  "low_stock_threshold",
  "is_active",
  "is_best_seller",
  "updated_at",
].join(",");

export async function fetchProducts({ includeInactive = false } = {}) {
  const fallback = getFallbackProducts();

  if (!isSupabaseConfigured || !supabase) {
    return includeInactive ? fallback : fallback.filter((item) => item.is_active);
  }

  const query = supabase.from("products").select(PRODUCT_SELECT_COLUMNS).order("name", { ascending: true });

  if (!includeInactive) {
    query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data) || data.length === 0) {
    return includeInactive ? fallback : fallback.filter((item) => item.is_active);
  }

  return data.map((row) => normalizeProduct(row));
}

export async function fetchProductById(productId) {
  const normalizedId = String(productId || "").trim();
  if (!normalizedId) return null;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT_COLUMNS)
      .eq("id", normalizedId)
      .maybeSingle();

    if (!error && data) {
      return normalizeProduct(data);
    }
  }

  const fallback = getFallbackProducts();
  return fallback.find((item) => item.id === normalizedId) || null;
}
