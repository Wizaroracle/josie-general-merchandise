import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Camera,
  X,
  Save,
} from "lucide-react";
import type { Product } from "../types";

const CATEGORIES = ["Watches", "Accessories", "Merchandise", "Other"];
const LOW_STOCK_THRESHOLD = 5;

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    category: "Watches",
    price: "",
    cost_price: "",
    stock_quantity: "",
    image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showImageOptions, setShowImageOptions] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = products;
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
      .eq("is_deleted", false) // ← only show active products
      .order("created_at", { ascending: false });
    setProducts(data ?? []);
    setIsLoading(false);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm({
      name: "",
      category: "Watches",
      price: "",
      cost_price: "",
      stock_quantity: "",
      image_url: "",
    });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      cost_price: product.cost_price?.toString() ?? "",
      stock_quantity: product.stock_quantity.toString(),
      image_url: product.image_url ?? "",
    });
    setImageFile(null);
    setImagePreview(product.image_url);
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.stock_quantity) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      let imageUrl = form.image_url;
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const payload = {
        name: form.name,
        category: form.category,
        price: parseFloat(form.price),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        stock_quantity: parseInt(form.stock_quantity),
        image_url: imageUrl || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Product updated!");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Product added!");
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (
      !confirm(
        `Delete "${product.name}"? It will be hidden from inventory but kept in sales history.`,
      )
    )
      return;

    const { error } = await supabase
      .from("products")
      .update({ is_deleted: true })
      .eq("id", product.id);

    if (error) {
      toast.error("Failed to delete product");
      return;
    }

    toast.success("Product removed from inventory");
    fetchProducts();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Inventory</h1>
          <p className="text-[#64748B] mt-1">
            {products.length} products total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-base active:scale-95"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
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
        <div className="flex gap-2">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-3.5 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white border-2 border-gray-200 text-[#64748B] hover:border-blue-500 hover:text-blue-500"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#64748B]">
          <Package size={56} className="mb-4 opacity-20" />
          <p className="text-xl font-medium">No products found</p>
          <p className="text-sm mt-1">Add your first product to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => openEdit(product)}
              onDelete={() => handleDelete(product)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Image Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Package size={32} className="text-gray-300" />
                        <span className="text-xs text-gray-400">
                          Tap to add photo
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Package size={16} /> Upload Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-medium text-blue-600 transition-colors"
                    >
                      <Camera size={16} /> Take Photo
                    </button>
                  </div>

                  {/* File upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  {/* Camera — works on tablet/mobile */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Casio G-Shock GA-100"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Category
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        form.category === cat
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-[#64748B] hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price + Cost */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Selling Price (₱) *
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                    Cost Price (₱)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Stock Quantity *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.stock_quantity}
                  onChange={(e) =>
                    setForm({ ...form, stock_quantity: e.target.value })
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3.5 border-2 border-gray-200 rounded-xl font-medium text-[#64748B] hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold rounded-xl transition-all"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />{" "}
                    {editingProduct ? "Save Changes" : "Add Product"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Product Card
function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLowStock = product.stock_quantity < LOW_STOCK_THRESHOLD;
  const isOutOfStock = product.stock_quantity === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      {/* Image */}
      <div className="h-44 bg-gray-50 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package size={48} className="text-gray-200" />
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-[#0F172A] text-sm leading-tight">
            {product.name}
          </p>
          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full shrink-0 font-medium">
            {product.category}
          </span>
        </div>
        <p className="text-lg font-bold text-blue-600 mb-3">
          ₱{product.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>

        {/* Stock Badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
            isOutOfStock
              ? "bg-red-100 text-red-600"
              : isLowStock
                ? "bg-amber-100 text-amber-600"
                : "bg-green-100 text-green-600"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isOutOfStock
                ? "bg-red-500"
                : isLowStock
                  ? "bg-amber-500"
                  : "bg-green-500"
            }`}
          />
          {isOutOfStock
            ? "Out of Stock"
            : isLowStock
              ? `Low Stock (${product.stock_quantity})`
              : `${product.stock_quantity} in stock`}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-[#64748B] hover:border-blue-500 hover:text-blue-500 transition-all"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-[#64748B] hover:border-red-500 hover:text-red-500 transition-all"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
