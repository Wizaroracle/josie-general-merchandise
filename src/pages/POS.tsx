import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Package,
  CheckCircle,
  X,
  Receipt,
  Wallet,
  RefreshCw,
} from "lucide-react";
import type { CartItem, Product } from "../types";

const PAYMENT_METHODS = ["Cash", "GCash", "Maya", "Card"];
const CATEGORIES = ["All", "Watches", "Accessories", "Merchandise", "Other"];
const LOW_STOCK_THRESHOLD = 5;

export default function POS() {
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState(0);

  const formatPeso = (value: number) => {
    return `₱${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const fetchProducts = useCallback(async (refreshOnly = false) => {
    if (refreshOnly) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Failed to load products.");
      setProducts([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setProducts(data ?? []);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const availableProducts = useMemo(() => {
    return products.filter((product) => product.stock_quantity > 0);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = availableProducts;

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      result = result.filter((product) =>
        product.name.toLowerCase().includes(keyword),
      );
    }

    if (selectedCategory !== "All") {
      result = result.filter(
        (product) => product.category === selectedCategory,
      );
    }

    return result;
  }, [availableProducts, search, selectedCategory]);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.product.id === product.id,
      );

      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Only ${product.stock_quantity} in stock.`);
          return currentCart;
        }

        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.product.price,
              }
            : item,
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: 1,
          subtotal: product.price,
        },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(
      (currentCart) =>
        currentCart
          .map((item) => {
            if (item.product.id !== productId) return item;

            const newQty = item.quantity + delta;

            if (newQty <= 0) return null;

            if (newQty > item.product.stock_quantity) {
              toast.error(`Only ${item.product.stock_quantity} in stock.`);
              return item;
            }

            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.product.price,
            };
          })
          .filter(Boolean) as CartItem[],
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.product.id !== productId),
    );
  };

  const clearCart = () => {
    if (cart.length === 0) return;

    const confirmed = confirm("Clear all items from cart?");

    if (!confirmed) return;

    setCart([]);
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;

    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }

    setIsSubmitting(true);

    try {
      const productIds = cart.map((item) => item.product.id);

      const { data: latestProducts, error: stockCheckError } = await supabase
        .from("products")
        .select("id, name, stock_quantity")
        .in("id", productIds);

      if (stockCheckError) throw stockCheckError;

      for (const item of cart) {
        const latest = latestProducts?.find(
          (product) => product.id === item.product.id,
        );

        if (!latest || Number(latest.stock_quantity) < item.quantity) {
          toast.error(
            `${item.product.name} does not have enough stock anymore.`,
          );

          void fetchProducts(true);
          setIsSubmitting(false);
          return;
        }
      }

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          recorded_by: profile?.id,
          total_amount: total,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          sale_date: getLocalDateString(),
        })
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      const stockUpdates = cart.map((item) => {
        const latest = latestProducts?.find(
          (product) => product.id === item.product.id,
        );

        const latestStock = Number(
          latest?.stock_quantity ?? item.product.stock_quantity,
        );

        return supabase
          .from("products")
          .update({ stock_quantity: latestStock - item.quantity })
          .eq("id", item.product.id);
      });

      const updateResults = await Promise.all(stockUpdates);
      const stockUpdateError = updateResults.find((result) => result.error);

      if (stockUpdateError?.error) throw stockUpdateError.error;

      setLastSaleTotal(total);
      setCart([]);
      setNotes("");
      setPaymentMethod("Cash");
      setShowMobileCart(false);
      setShowSuccess(true);

      void fetchProducts(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to record sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="h-full overflow-hidden bg-[#F6F0EA] p-3 text-[#1F1712] sm:p-4 lg:p-5">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Products Section */}
        <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
          {/* Header */}
          <section className="rounded-[22px] border border-[#E6D2BD] bg-[#F8F2EC] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1712] sm:text-3xl">
                  New Sale
                </h1>

                <p className="mt-1 text-sm font-semibold text-[#6F625A] sm:text-base">
                  Tap a product to add it to the cart.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex">
                <InfoCard label="Available" value={availableProducts.length} />

                <button
                  type="button"
                  onClick={() => setShowMobileCart(true)}
                  className="rounded-2xl border border-[#E6D2BD] bg-[#FFF8F1] px-4 py-3 text-left transition hover:border-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 md:pointer-events-none"
                >
                  <p className="text-xs font-extrabold text-[#7C6D64]">
                    In Cart
                  </p>
                  <p className="text-2xl font-extrabold leading-tight text-[#FF6B0A]">
                    {cartItemCount}
                  </p>
                </button>
              </div>
            </div>
          </section>

          {/* Search and Filters */}
          <section className="rounded-[22px] border border-[#E6D2BD] bg-[#FFF8F1] p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C6D64]"
                  />

                  <input
                    type="text"
                    placeholder="Search products..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="min-h-[50px] w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] py-3 pl-11 pr-12 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#7C6D64] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void fetchProducts(true)}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-5 py-3 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
                >
                  <RefreshCw
                    size={20}
                    className={isRefreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[44px] shrink-0 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                      selectedCategory === category
                        ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20"
                        : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold text-[#7C6D64]">
                Showing {filteredProducts.length} product
                {filteredProducts.length === 1 ? "" : "s"}
              </p>
            </div>
          </section>

          {/* Products Grid */}
          <section className="min-h-0 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-[22px] border border-[#E6D2BD] bg-[#FFF8F1]">
                <div className="relative flex w-full max-w-xs flex-col items-center overflow-hidden rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] px-7 py-7 text-center shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-[#FF6B0A]" />

                  <div className="relative mb-2 flex h-16 w-16 items-center justify-center">
                    <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-[#FFE3C8] border-t-[#FF6B0A]" />

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0DE]">
                      <Package size={25} className="text-[#FF6B0A]" />
                    </div>
                  </div>

                  <p className="text-lg font-extrabold text-[#1F1712]">
                    Loading products
                  </p>

                  <p className="mt-1 text-sm font-semibold text-[#7C6D64]">
                    Please wait...
                  </p>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#E6D2BD] bg-[#FFF8F1] px-5 text-center">
                <Package size={54} className="mb-4 text-[#FF6B0A]/35" />

                <p className="text-2xl font-extrabold text-[#1F1712]">
                  No products available
                </p>

                <p className="mt-2 max-w-md text-base font-medium text-[#6F625A]">
                  Try another search or category. Products with zero stock are
                  hidden from this sale screen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3 pb-2">
                {filteredProducts.map((product) => {
                  const cartItem = cart.find(
                    (item) => item.product.id === product.id,
                  );

                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      quantityInCart={cartItem?.quantity ?? 0}
                      formatPeso={formatPeso}
                      onAdd={() => addToCart(product)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </section>

        {/* Tablet/Desktop Cart - visible on tablet and larger */}
        <aside className="hidden min-h-0 md:block">
          <CartPanel
            cart={cart}
            cartItemCount={cartItemCount}
            total={total}
            paymentMethod={paymentMethod}
            notes={notes}
            isSubmitting={isSubmitting}
            formatPeso={formatPeso}
            onPaymentChange={setPaymentMethod}
            onNotesChange={setNotes}
            onMinus={(id) => updateQty(id, -1)}
            onPlus={(id) => updateQty(id, 1)}
            onRemove={removeFromCart}
            onClear={clearCart}
            onCheckout={handleCheckout}
          />
        </aside>
      </div>

      {/* Mobile Floating Cart Button */}
      {cartItemCount > 0 && !showMobileCart && !showSuccess && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6D2BD] bg-[#FFF8F1] p-3 shadow-[0_-8px_30px_rgba(59,49,42,0.12)] md:hidden">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className="flex min-h-[60px] w-full items-center justify-between gap-4 rounded-2xl bg-[#FF6B0A] px-5 py-3 text-white shadow-lg shadow-[#FF6B0A]/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <ShoppingCart size={22} />
              </div>

              <div className="text-left">
                <p className="text-sm font-bold text-white/80">
                  {cartItemCount} item{cartItemCount === 1 ? "" : "s"} in cart
                </p>
                <p className="text-xl font-extrabold">{formatPeso(total)}</p>
              </div>
            </div>

            <span className="rounded-xl bg-white/15 px-4 py-2 text-base font-extrabold">
              View
            </span>
          </button>
        </div>
      )}

      {/* Mobile Cart Drawer */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setShowMobileCart(false)}
            className="absolute inset-0 bg-[#1F1712]/60 backdrop-blur-sm"
          />

          <div className="absolute inset-x-0 bottom-0 h-[92dvh] rounded-t-[28px] bg-[#FFF8F1] shadow-2xl">
            <CartPanel
              mobile
              cart={cart}
              cartItemCount={cartItemCount}
              total={total}
              paymentMethod={paymentMethod}
              notes={notes}
              isSubmitting={isSubmitting}
              formatPeso={formatPeso}
              onClose={() => setShowMobileCart(false)}
              onPaymentChange={setPaymentMethod}
              onNotesChange={setNotes}
              onMinus={(id) => updateQty(id, -1)}
              onPlus={(id) => updateQty(id, 1)}
              onRemove={removeFromCart}
              onClear={clearCart}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1F1712]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#E6D2BD] bg-[#FFF8F1] p-7 text-center shadow-2xl sm:p-9">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-green-50">
              <CheckCircle size={54} className="text-green-600" />
            </div>

            <h2 className="text-3xl font-extrabold text-[#1F1712]">
              Sale Recorded!
            </h2>

            <p className="mt-2 text-base font-semibold text-[#6F625A]">
              The sale has been saved successfully.
            </p>

            <div className="my-6 rounded-[22px] border border-[#E6D2BD] bg-[#FFFDF9] p-5">
              <p className="text-sm font-extrabold uppercase tracking-wide text-[#7C6D64]">
                Total Amount
              </p>

              <p className="mt-1 text-4xl font-extrabold text-[#FF6B0A]">
                {formatPeso(lastSaleTotal)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-5 py-3.5 text-base font-extrabold text-white transition hover:bg-[#E85F08] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
            >
              <CheckCircle size={22} />
              Start New Sale
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E6D2BD] bg-[#FFF8F1] px-4 py-3">
      <p className="text-xs font-extrabold text-[#7C6D64]">{label}</p>
      <p className="text-2xl font-extrabold leading-tight text-[#1F1712]">
        {value}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  quantityInCart,
  formatPeso,
  onAdd,
}: {
  product: Product;
  quantityInCart: number;
  formatPeso: (value: number) => string;
  onAdd: () => void;
}) {
  const isLowStock = product.stock_quantity <= LOW_STOCK_THRESHOLD;
  const reachedMax = quantityInCart >= product.stock_quantity;

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${product.name} to cart`}
      className={`group relative flex flex-col overflow-hidden rounded-[20px] border bg-[#FFF8F1] text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
        quantityInCart > 0
          ? "border-[#FF6B0A] shadow-[#FF6B0A]/15"
          : "border-[#E6D2BD]"
      }`}
    >
      {quantityInCart > 0 && (
        <div className="absolute right-2 top-2 z-10 flex h-8 min-w-8 items-center justify-center rounded-full bg-[#FF6B0A] px-2 text-white shadow-md">
          <span className="text-xs font-extrabold">{quantityInCart}</span>
        </div>
      )}

      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#FFFDF9]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <Package size={42} className="text-[#FF6B0A]/25" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2">
          <p className="break-words text-sm font-extrabold leading-snug text-[#1F1712]">
            {product.name}
          </p>

          <span className="mt-1 inline-flex rounded-full bg-[#FFF0DE] px-2 py-0.5 text-[11px] font-extrabold text-[#FF6B0A]">
            {product.category}
          </span>
        </div>

        <p className="mb-2 text-xl font-extrabold leading-tight text-[#FF6B0A]">
          {formatPeso(product.price)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1.5 text-xs font-extrabold ${
              isLowStock
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-700"
            }`}
          >
            {product.stock_quantity} left
          </span>

          <span
            className={`inline-flex min-h-9 items-center gap-1 rounded-xl px-3 py-2 text-sm font-extrabold ${
              reachedMax
                ? "bg-[#EAD8C7] text-[#6F625A]"
                : "bg-[#FFF0DE] text-[#FF6B0A]"
            }`}
          >
            <Plus size={15} />
            {reachedMax ? "Max" : "Add"}
          </span>
        </div>
      </div>
    </button>
  );
}

function CartPanel({
  cart,
  cartItemCount,
  total,
  paymentMethod,
  notes,
  isSubmitting,
  formatPeso,
  mobile = false,
  onClose,
  onPaymentChange,
  onNotesChange,
  onMinus,
  onPlus,
  onRemove,
  onClear,
  onCheckout,
}: {
  cart: CartItem[];
  cartItemCount: number;
  total: number;
  paymentMethod: string;
  notes: string;
  isSubmitting: boolean;
  formatPeso: (value: number) => string;
  mobile?: boolean;
  onClose?: () => void;
  onPaymentChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onMinus: (productId: string) => void;
  onPlus: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  return (
    <section
      className={`grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-[#E6D2BD] bg-[#FFF8F1] ${
        mobile
          ? "h-[92dvh] rounded-t-[28px] border-t"
          : "h-full rounded-[22px] border shadow-sm"
      }`}
    >
      {/* Cart Header */}
      <div className="border-b border-[#E6D2BD] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
              <ShoppingCart size={22} />
            </div>

            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-[#1F1712]">Cart</h2>
              <p className="text-sm font-semibold text-[#7C6D64]">
                {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-xl bg-red-50 px-3 py-2 text-sm font-extrabold text-red-600 transition hover:bg-red-100"
              >
                Clear
              </button>
            )}

            {mobile && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0DE] text-[#6F625A] transition hover:text-[#FF6B0A]"
              >
                <X size={21} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cart Items */}
      <div className="min-h-0 overflow-y-auto px-3 py-3">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E6D2BD] bg-[#FFFDF9] px-4 py-6 text-center">
            <ShoppingCart size={48} className="mb-3 text-[#FF6B0A]/35" />

            <p className="text-lg font-extrabold text-[#1F1712]">
              Cart is empty
            </p>

            <p className="mt-1 text-sm font-semibold text-[#6F625A]">
              Tap a product card to add an item.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cart.map((item) => (
              <CartItemCard
                key={item.product.id}
                item={item}
                formatPeso={formatPeso}
                onMinus={() => onMinus(item.product.id)}
                onPlus={() => onPlus(item.product.id)}
                onRemove={() => onRemove(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-[#E6D2BD] bg-[#FFF8F1] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="space-y-3">
          {/* Payment Method */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Wallet size={17} className="text-[#FF6B0A]" />
              <p className="text-xs font-extrabold uppercase tracking-wide text-[#6F625A]">
                Payment Method
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onPaymentChange(method)}
                  className={`min-h-[42px] rounded-xl px-3 py-2 text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                    paymentMethod === method
                      ? "bg-[#FF6B0A] text-white shadow-md shadow-[#FF6B0A]/20"
                      : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#6F625A]">
              Notes Optional
            </p>

            <input
              type="text"
              placeholder="Example: Regular customer"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              className="min-h-[46px] w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3 text-sm font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
            />
          </div>

          {/* Total */}
          <div className="rounded-[20px] border border-[#E6D2BD] bg-[#FFFDF9] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#7C6D64]">
                  Total
                </p>
                <p className="text-xs font-semibold text-[#A8988D]">
                  {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
                </p>
              </div>

              <p className="text-2xl font-extrabold text-[#1F1712]">
                {formatPeso(total)}
              </p>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            onClick={onCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-[#FF6B0A] px-5 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF6B0A]/20 transition-all hover:bg-[#E85F08] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#D8C8B8] disabled:text-white/70 disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
          >
            {isSubmitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Recording...
              </>
            ) : (
              <>
                <Receipt size={22} />
                Record Sale
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function CartItemCard({
  item,
  formatPeso,
  onMinus,
  onPlus,
  onRemove,
}: {
  item: CartItem;
  formatPeso: (value: number) => string;
  onMinus: () => void;
  onPlus: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-[#E6D2BD] bg-[#FFFDF9] p-2.5">
      <div className="flex gap-2.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E6D2BD] bg-[#FFF8F1]">
          {item.product.image_url ? (
            <img
              src={item.product.image_url}
              alt={item.product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package size={21} className="text-[#FF6B0A]/25" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-extrabold leading-snug text-[#1F1712]">
            {item.product.name}
          </p>

          <p className="mt-0.5 text-xs font-bold text-[#7C6D64]">
            {formatPeso(item.product.price)} each
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.product.name}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center rounded-xl border border-[#E6D2BD] bg-[#FFF8F1] p-1">
          <button
            type="button"
            onClick={onMinus}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFDF9] text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
          >
            <Minus size={16} />
          </button>

          <span className="w-9 text-center text-base font-extrabold text-[#1F1712]">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={onPlus}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFFDF9] text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="text-right">
          <p className="text-xs font-bold text-[#7C6D64]">Subtotal</p>

          <p className="text-base font-extrabold text-[#FF6B0A]">
            {formatPeso(item.subtotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
