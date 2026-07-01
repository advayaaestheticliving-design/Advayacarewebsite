import React from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import {
  adjustAdminProductStock,
  listAdminProducts,
  saveAdminProduct,
  setAdminProductActive,
  uploadAdminProductImage,
} from "../lib/adminProductsApi";

const EMPTY_FORM = {
  id: "",
  name: "",
  price_inr: "0",
  compare_at_price: "0",
  stock_quantity: "0",
  low_stock_threshold: "5",
  is_active: true,
  is_best_seller: false,
  filter_tags: "",
  images: "",
  one_line_summary: "",
  ingredients: "",
  benefits_brief: "",
  benefits_detail: "",
  use_cases: "",
  is_new_arrival: false,
};

function toLines(value) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

function toCommaList(value) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

function formatProductForForm(product) {
  const allTags = Array.isArray(product?.filter_tags) ? product.filter_tags : [];
  const isNewArrival = allTags.some(tag => String(tag).trim().toLowerCase() === "new arrival");
  const otherTags = allTags.filter(tag => String(tag).trim().toLowerCase() !== "new arrival");

  return {
    id: String(product?.id || ""),
    name: String(product?.name || ""),
    price_inr: String(Number(product?.price_inr || 0)),
    compare_at_price: String(Number(product?.compare_at_price || 0)),
    stock_quantity: String(Number(product?.stock_quantity || 0)),
    low_stock_threshold: String(Number(product?.low_stock_threshold || 5)),
    is_active: product?.is_active !== false,
    is_best_seller: product?.is_best_seller === true,
    filter_tags: toCommaList(otherTags),
    images: toLines(product?.images),
    one_line_summary: String(product?.one_line_summary || ""),
    ingredients: String(product?.ingredients || ""),
    benefits_brief: String(product?.benefits_brief || ""),
    benefits_detail: String(product?.benefits_detail || ""),
    use_cases: String(product?.use_cases || ""),
    is_new_arrival: isNewArrival,
  };
}

function parseLines(value) {
  return String(value || "")
    .split(/\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function AdminProductsPage() {
  const admin = useAdminAccess();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [products, setProducts] = React.useState([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [stockDraftById, setStockDraftById] = React.useState({});
  const [stockSavingId, setStockSavingId] = React.useState("");
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const fileInputRef = React.useRef(null);

  const selectedProduct = React.useMemo(
    () => products.find((item) => item.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const loadProducts = React.useCallback(async () => {
    if (!admin.authorized) {
      setProducts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await listAdminProducts({ includeInactive: true });
      setProducts(Array.isArray(rows) ? rows : []);
      setStockDraftById(
        (Array.isArray(rows) ? rows : []).reduce((acc, item) => ({
          ...acc,
          [item.id]: String(Number(item?.stock_quantity || 0)),
        }), {})
      );
    } catch (loadError) {
      setError(loadError?.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadProducts().catch(() => undefined);
    }
  }, [admin.authorized, admin.checkingAccess, loadProducts]);

  const selectProduct = (product) => {
    setSelectedProductId(product.id);
    setForm(formatProductForForm(product));
    setError("");
    setSuccess("");
  };

  const handleCreateNew = () => {
    setSelectedProductId("");
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProduct = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const parsedTags = parseCommaList(form.filter_tags);
      const tagSet = new Set(parsedTags);
      if (form.is_new_arrival) {
        tagSet.add("New Arrival");
      }

      const payload = {
        ...form,
        price_inr: Number(form.price_inr || 0),
        compare_at_price: Number(form.compare_at_price || 0),
        stock_quantity: Number(form.stock_quantity || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 5),
        filter_tags: Array.from(tagSet),
        images: parseLines(form.images),
      };

      const saved = await saveAdminProduct(payload);
      if (!saved) {
        throw new Error("Product save returned no data.");
      }

      setSuccess("Product saved successfully.");
      setSelectedProductId(saved.id);
      setForm(formatProductForForm(saved));
      await loadProducts();
    } catch (saveError) {
      setError(saveError?.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleStockUpdate = async (productId) => {
    setStockSavingId(productId);
    setError("");
    setSuccess("");

    try {
      const stockValue = Number(stockDraftById[productId] || 0);
      const updated = await adjustAdminProductStock(productId, stockValue, "Admin quick stock update");
      if (!updated) {
        throw new Error("Stock update returned no data.");
      }

      setSuccess("Stock updated successfully.");
      setStockDraftById((prev) => ({
        ...prev,
        [productId]: String(Number(updated.stock_quantity || stockValue)),
      }));

      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
      if (selectedProductId === productId) {
        setForm(formatProductForForm(updated));
      }
    } catch (stockError) {
      setError(stockError?.message || "Could not update stock.");
    } finally {
      setStockSavingId("");
    }
  };

  const handleToggleActive = async (product) => {
    setError("");
    setSuccess("");

    try {
      const updated = await setAdminProductActive(product.id, !product.is_active);
      if (!updated) {
        throw new Error("Product status update returned no data.");
      }

      setSuccess(`Product ${updated.is_active ? "activated" : "archived"}.`);
      setProducts((prev) => prev.map((item) => (item.id === product.id ? updated : item)));
      if (selectedProductId === product.id) {
        setForm(formatProductForForm(updated));
      }
    } catch (toggleError) {
      setError(toggleError?.message || "Could not update product status.");
    }
  };

  const handleUploadImage = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Select an image before uploading.");
      return;
    }

    setUploadingImage(true);
    setError("");
    setSuccess("");

    try {
      const uploaded = await uploadAdminProductImage(file, form.name || "product-image");
      if (!uploaded?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }

      const existing = parseLines(form.images);
      updateField("images", [...existing, uploaded.publicUrl].join("\n"));
      setSuccess("Image uploaded and added to image list.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(uploadError?.message || "Could not upload product image.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (admin.checkingAccess) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <p className="text-sm text-white/80">Checking admin access...</p>
      </div>
    );
  }

  if (!admin.authorized) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Admin Products</h1>
        <p className="text-sm text-white/80 mt-1">
          Add new items, edit product content, upload images, and manage stock levels.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleCreateNew}
              className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
            >
              New Product
            </button>
            <button
              type="button"
              onClick={() => loadProducts()}
              className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
            >
              Refresh
            </button>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

          <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
            <div className="rounded-2xl border border-neutral-700 bg-black/40 p-4 space-y-3 max-h-[70vh] overflow-auto">
              <h2 className="text-sm font-semibold text-white">Products</h2>
              {loading ? <p className="text-xs text-white/70">Loading...</p> : null}
              {!loading && products.length === 0 ? <p className="text-xs text-white/70">No products found.</p> : null}

              {products.map((product) => {
                const isSelected = selectedProductId === product.id;
                return (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-3 space-y-2 ${
                      isSelected ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-neutral-700 bg-black/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectProduct(product)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      <p className="text-[11px] text-white/70">{product.id}</p>
                      <p className="text-xs text-white/80 mt-1">
                        Stock: {Number(product.stock_quantity || 0)}
                        {product.is_active ? "" : " (Archived)"}
                      </p>
                    </button>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={stockDraftById[product.id] || "0"}
                        onChange={(event) =>
                          setStockDraftById((prev) => ({
                            ...prev,
                            [product.id]: event.target.value,
                          }))
                        }
                        className="w-20 rounded-full border border-neutral-600 bg-black/60 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleStockUpdate(product.id)}
                        disabled={stockSavingId === product.id}
                        className="rounded-full bg-[#D4AF37] px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-60"
                      >
                        {stockSavingId === product.id ? "Saving..." : "Update Stock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(product)}
                        className="rounded-full border border-neutral-500 px-3 py-1.5 text-[11px] font-medium text-white"
                      >
                        {product.is_active ? "Archive" : "Activate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-neutral-700 bg-black/40 p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">
                {selectedProduct ? `Editing: ${selectedProduct.name}` : "Create New Product"}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-white/80">
                  <span>Product ID (optional for new items)</span>
                  <input
                    type="text"
                    value={form.id}
                    onChange={(event) => updateField("id", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Price (INR)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.price_inr}
                    onChange={(event) => updateField("price_inr", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Compare at Price (INR)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.compare_at_price}
                    onChange={(event) => updateField("compare_at_price", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Current Stock</span>
                  <input
                    type="number"
                    min={0}
                    value={form.stock_quantity}
                    onChange={(event) => updateField("stock_quantity", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Low Stock Threshold</span>
                  <input
                    type="number"
                    min={0}
                    value={form.low_stock_threshold}
                    onChange={(event) => updateField("low_stock_threshold", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-white/80 pt-6">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => updateField("is_active", event.target.checked)}
                  />
                  Product is active on storefront
                </label>
                <label className="flex items-center gap-2 text-xs text-white/80 pt-6">
                  <input
                    type="checkbox"
                    checked={form.is_best_seller}
                    onChange={(event) => updateField("is_best_seller", event.target.checked)}
                  />
                  Best Seller badge
                </label>
                <label className="flex items-center gap-2 text-xs text-white/80 pt-6">
                  <input
                    type="checkbox"
                    checked={form.is_new_arrival}
                    onChange={(event) => updateField("is_new_arrival", event.target.checked)}
                  />
                  New Arrival Badge
                </label>
              </div>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Filter Tags (comma separated)</span>
                <input
                  type="text"
                  value={form.filter_tags}
                  onChange={(event) => updateField("filter_tags", event.target.value)}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Images (one URL or filename per line)</span>
                <textarea
                  value={form.images}
                  onChange={(event) => updateField("images", event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="text-xs text-white/80"
                />
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={uploadingImage}
                  className="rounded-full border border-neutral-500 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                >
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </button>
              </div>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>One-line Summary</span>
                <textarea
                  value={form.one_line_summary}
                  onChange={(event) => updateField("one_line_summary", event.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Ingredients</span>
                <textarea
                  value={form.ingredients}
                  onChange={(event) => updateField("ingredients", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Benefits (Brief)</span>
                <textarea
                  value={form.benefits_brief}
                  onChange={(event) => updateField("benefits_brief", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Benefits (Detailed)</span>
                <textarea
                  value={form.benefits_detail}
                  onChange={(event) => updateField("benefits_detail", event.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Use Cases</span>
                <textarea
                  value={form.use_cases}
                  onChange={(event) => updateField("use_cases", event.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving}
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Product"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminProductsPage;
