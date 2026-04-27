import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { CartItem, Product } from "../types";

const PAYMENT_METHODS = ["Cash", "GCash", "Maya", "Card"];

export default function POS() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState(0);

  const CATEGORIES = ["All", "Watches", "Accessories", "Merchandise", "Other"];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = products.filter((p) => p.stock_quantity > 0);
    if (search)
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      );
    if (selectedCategory !== "All")
      result = result.filter((p) => p.category === selectedCategory);
    setFiltered(result);
  }, [search, selectedCategory, products]);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("name");
    setProducts(data ?? []);
    setIsLoading(false);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        toast.error(`Only ${product.stock_quantity} in stock`);
        return;
      }
      setCart(
        cart.map((c) =>
          c.product.id === product.id
            ? {
                ...c,
                quantity: c.quantity + 1,
                subtotal: (c.quantity + 1) * c.product.price,
              }
            : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          subtotal: product.price,
        },
      ]);
    }
    toast.success(`${product.name} added`, { duration: 1000 });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((c) => {
            if (c.product.id !== productId) return c;
            const newQty = c.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > c.product.stock_quantity) {
              toast.error(`Only ${c.product.stock_quantity} in stock`);
              return c;
            }
            return {
              ...c,
              quantity: newQty,
              subtotal: newQty * c.product.price,
            };
          })
          .filter(Boolean) as CartItem[],
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!confirm("Clear all items from cart?")) return;
    setCart([]);
  };

  const total = cart.reduce((sum, c) => sum + c.subtotal, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setIsSubmitting(true);
    try {
      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          recorded_by: profile?.id,
          total_amount: total,
          payment_method: paymentMethod,
          notes: notes || null,
          sale_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const saleItems = cart.map((c) => ({
        sale_id: sale.id,
        product_id: c.product.id,
        quantity: c.quantity,
        unit_price: c.product.price,
        subtotal: c.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update stock for each product
      for (const c of cart) {
        const newStock = c.product.stock_quantity - c.quantity;
        await supabase
          .from("products")
          .update({ stock_quantity: newStock })
          .eq("id", c.product.id);
      }

      setLastSaleTotal(total);
      setCart([]);
      setNotes("");
      setShowSuccess(true);
      fetchProducts();
    } catch (err) {
      toast.error("Failed to record sale. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left — Product Selection */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A]">New Sale</h1>
          <p className="text-[#64748B] text-sm mt-0.5">
            Tap a product to add it to the cart
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]"
          />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 ${
                selectedCategory === cat
                  ? "bg-blue-500 text-white"
                  : "bg-white border-2 border-gray-200 text-[#64748B]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#64748B]">
              <Package size={48} className="mb-3 opacity-20" />
              <p className="font-medium">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 pb-4">
              {filtered.map((product) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative bg-white rounded-2xl border-2 p-3 text-left transition-all active:scale-95 hover:shadow-md ${
                      inCart
                        ? "border-blue-500 shadow-md shadow-blue-500/10"
                        : "border-gray-100"
                    }`}
                  >
                    {/* Cart badge */}
                    {inCart && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">
                          {inCart.quantity}
                        </span>
                      </div>
                    )}

                    {/* Image */}
                    <div className="h-24 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden mb-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Package size={32} className="text-gray-200" />
                      )}
                    </div>

                    <p className="text-sm font-semibold text-[#0F172A] leading-tight mb-1 line-clamp-2">
                      {product.name}
                    </p>
                    <p className="text-base font-bold text-blue-600">
                      ₱
                      {product.price.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {product.stock_quantity} in stock
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-96 bg-white border-l border-gray-100 flex flex-col">
        {/* Cart Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-500" />
            <h2 className="text-lg font-bold text-[#0F172A]">Cart</h2>
            {cart.length > 0 && (
              <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {cart.length}
                </span>
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#64748B]">
              <ShoppingCart size={48} className="mb-3 opacity-20" />
              <p className="font-medium text-sm">Cart is empty</p>
              <p className="text-xs mt-1 text-center">
                Tap any product to add it here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
                >
                  {/* Image */}
                  <div className="w-12 h-12 bg-white rounded-lg overflow-hidden flex items-center justify-center shrink-0 border border-gray-100">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={20} className="text-gray-200" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      ₱{item.product.price.toLocaleString()}
                    </p>
                  </div>

                  {/* Qty Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.product.id, -1)}
                      className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 1)}
                      className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Subtotal + Delete */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-600">
                      ₱{item.subtotal.toLocaleString()}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-red-400 hover:text-red-600 mt-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="px-6 py-5 border-t border-gray-100 space-y-4">
          {/* Payment Method */}
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
              Payment Method
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    paymentMethod === method
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-[#64748B] hover:bg-gray-200"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
              Notes (optional)
            </p>
            <input
              type="text"
              placeholder="e.g. Regular customer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <span className="text-base font-semibold text-[#64748B]">
              Total
            </span>
            <span className="text-2xl font-bold text-[#0F172A]">
              ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-xl text-base transition-all active:scale-95 shadow-lg shadow-green-500/20"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={20} /> Record Sale
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center shadow-2xl max-w-sm w-full mx-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-2">
              Sale Recorded!
            </h2>
            <p className="text-[#64748B] text-center mb-2">
              The sale has been saved successfully.
            </p>
            <p className="text-3xl font-bold text-green-600 mb-6">
              ₱
              {lastSaleTotal.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowSuccess(false)}
                className="flex-1 py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
