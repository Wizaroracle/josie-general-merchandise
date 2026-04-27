import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
  Upload,
  RotateCcw,
  AlertTriangle,
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

  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );

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
  const [showCameraModal, setShowCameraModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const totalLowStock = products.filter(
    (product) => product.stock_quantity < LOW_STOCK_THRESHOLD
  ).length;

  const totalOutOfStock = products.filter(
    (product) => product.stock_quantity === 0
  ).length;

  const formatPeso = (value: number) => {
    return `₱${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load inventory");
      setIsLoading(false);
      return;
    }

    setProducts(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let result = products;

    if (search.trim()) {
      const keyword = search.toLowerCase().trim();

      result = result.filter((product) =>
        product.name.toLowerCase().includes(keyword)
      );
    }

    if (selectedCategory !== "All") {
      result = result.filter(
        (product) => product.category === selectedCategory
      );
    }

    setFiltered(result);
  }, [search, selectedCategory, products]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const openCamera = async (facing: "environment" | "user" = "environment") => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera is not supported on this device.");
        return;
      }

      stopCameraStream();

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: facing } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
        });
      }

      streamRef.current = stream;
      setFacingMode(facing);
      setShowCameraModal(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 150);
    } catch {
      toast.error("Camera not available. Please use Upload Photo instead.");
    }
  };

  const switchCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    void openCamera(newFacing);
  };

  const closeCamera = () => {
    stopCameraStream();
    setShowCameraModal(false);
    setFacingMode("environment");
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d")?.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        setImageFile(file);
        setImagePreview(URL.createObjectURL(blob));
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const resetForm = () => {
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
  };

  const openAdd = () => {
    setEditingProduct(null);
    resetForm();
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

  const closeProductModal = () => {
    closeCamera();
    setShowModal(false);
    setIsSubmitting(false);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Image is too large. Please choose an image below 5MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    event.target.value = "";
  };

  const removeSelectedImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm((current) => ({ ...current, image_url: "" }));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const random = Math.random().toString(36).slice(2);
    const fileName = `products/${Date.now()}-${random}.${ext}`;

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
    const name = form.name.trim();
    const price = Number(form.price);
    const costPrice = form.cost_price ? Number(form.cost_price) : null;
    const stockQuantity = Number(form.stock_quantity);

    if (!name || !form.price || !form.stock_quantity) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      toast.error("Please enter a valid selling price.");
      return;
    }

    if (costPrice !== null && (Number.isNaN(costPrice) || costPrice < 0)) {
      toast.error("Please enter a valid cost price.");
      return;
    }

    if (
      Number.isNaN(stockQuantity) ||
      stockQuantity < 0 ||
      !Number.isInteger(stockQuantity)
    ) {
      toast.error("Stock quantity must be a whole number.");
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const payload = {
        name,
        category: form.category,
        price,
        cost_price: costPrice,
        stock_quantity: stockQuantity,
        image_url: imageUrl || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);

        if (error) throw error;

        toast.success("Product updated successfully!");
      } else {
        const { error } = await supabase.from("products").insert(payload);

        if (error) throw error;

        toast.success("Product added successfully!");
      }

      closeProductModal();
      void fetchProducts();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = confirm(
      `Delete "${product.name}"?\n\nIt will be hidden from inventory but kept in sales history.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .update({ is_deleted: true })
      .eq("id", product.id);

    if (error) {
      toast.error("Failed to delete product.");
      return;
    }

    toast.success("Product removed from inventory.");
    void fetchProducts();
  };

  return (
    <main className="min-h-full bg-[#F6F0EA] p-4 text-[#1F1712] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[24px] border border-[#E6D2BD] bg-[#F8F2EC] p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1F1712] sm:text-4xl">
                Inventory
              </h1>

              <p className="mt-1 text-base font-semibold text-[#6F625A] sm:text-lg">
                Manage products, prices, photos, and stock levels.
              </p>
            </div>

            <button
              type="button"
              onClick={openAdd}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF6B0A]/20 transition-all hover:bg-[#E85F08] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25 sm:w-auto"
            >
              <Plus size={22} />
              Add Product
            </button>
          </div>
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <InventorySummaryCard
            label="Total Products"
            value={products.length.toString()}
            icon={<Package size={24} />}
          />

          <InventorySummaryCard
            label="Low Stock"
            value={totalLowStock.toString()}
            icon={<AlertTriangle size={24} />}
            warning={totalLowStock > 0}
          />

          <InventorySummaryCard
            label="Out of Stock"
            value={totalOutOfStock.toString()}
            icon={<AlertTriangle size={24} />}
            danger={totalOutOfStock > 0}
          />
        </section>

        {/* Search + Filter */}
        <section className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search
                size={22}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C6D64]"
              />

              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] py-3.5 pl-12 pr-12 text-base font-semibold text-[#1F1712] outline-none transition focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
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

            <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
              {["All", ...CATEGORIES].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`min-h-12 shrink-0 rounded-2xl px-5 py-3 text-base font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                    selectedCategory === category
                      ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20"
                      : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1]">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF6B0A] border-t-transparent" />
              <p className="text-lg font-bold text-[#3B312A]">
                Loading inventory...
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#E6D2BD] bg-[#FFF8F1] px-5 text-center">
            <Package size={60} className="mb-4 text-[#FF6B0A]/35" />

            <p className="text-2xl font-extrabold text-[#1F1712]">
              No products found
            </p>

            <p className="mt-2 max-w-md text-base font-medium text-[#6F625A]">
              Try changing your search or category filter. You can also add a
              new product to your inventory.
            </p>

            <button
              type="button"
              onClick={openAdd}
              className="mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-6 py-3 text-base font-extrabold text-white transition hover:bg-[#E85F08]"
            >
              <Plus size={20} />
              Add Product
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                formatPeso={formatPeso}
                onEdit={() => openEdit(product)}
                onDelete={() => handleDelete(product)}
              />
            ))}
          </section>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1712]/60 p-3 backdrop-blur-sm sm:p-4">
            <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[#E6D2BD] bg-[#FFF8F1] shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#E6D2BD] px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#1F1712]">
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-[#7C6D64]">
                    Fields marked with * are required.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeProductModal}
                  aria-label="Close product modal"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto p-5 sm:p-6">
                {/* Image Upload */}
                <section>
                  <label className="mb-3 block text-base font-extrabold text-[#1F1712]">
                    Product Photo
                  </label>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-[#E6D2BD] bg-[#FFFDF9] transition hover:border-[#FF6B0A] sm:h-36 sm:w-36 sm:shrink-0"
                    >
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Product preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 px-4 text-center">
                          <Package size={40} className="text-[#FF6B0A]/35" />
                          <span className="text-sm font-bold text-[#7C6D64]">
                            Tap to add photo
                          </span>
                        </div>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col gap-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
                        >
                          <Upload size={20} />
                          Upload Photo
                        </button>

                        <button
                          type="button"
                          onClick={() => openCamera("environment")}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#FFF0DE] px-4 py-3 text-base font-extrabold text-[#FF6B0A] transition hover:bg-[#FFE3C8] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
                        >
                          <Camera size={20} />
                          Take Photo
                        </button>
                      </div>

                      {imagePreview && (
                        <button
                          type="button"
                          onClick={removeSelectedImage}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-base font-extrabold text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={18} />
                          Remove Photo
                        </button>
                      )}

                      <p className="text-sm font-medium text-[#7C6D64]">
                        Recommended: clear photo, under 5MB.
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                </section>

                {/* Product Name */}
                <section>
                  <label className="mb-2 block text-base font-extrabold text-[#1F1712]">
                    Product Name *
                  </label>

                  <input
                    type="text"
                    placeholder="Example: Casio G-Shock GA-100"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                  />
                </section>

                {/* Category */}
                <section>
                  <label className="mb-2 block text-base font-extrabold text-[#1F1712]">
                    Category
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, category: category })
                        }
                        className={`min-h-11 rounded-2xl px-4 py-2.5 text-base font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                          form.category === category
                            ? "bg-[#FF6B0A] text-white shadow-md shadow-[#FF6B0A]/20"
                            : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Price + Cost */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-base font-extrabold text-[#1F1712]">
                      Selling Price (₱) *
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.price}
                      onChange={(event) =>
                        setForm({ ...form, price: event.target.value })
                      }
                      className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-base font-extrabold text-[#1F1712]">
                      Cost Price (₱)
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.cost_price}
                      onChange={(event) =>
                        setForm({ ...form, cost_price: event.target.value })
                      }
                      className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                    />
                  </div>
                </section>

                {/* Stock */}
                <section>
                  <label className="mb-2 block text-base font-extrabold text-[#1F1712]">
                    Stock Quantity *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.stock_quantity}
                    onChange={(event) =>
                      setForm({ ...form, stock_quantity: event.target.value })
                    }
                    className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                  />
                </section>
              </div>

              {/* Modal Footer */}
              <div className="grid grid-cols-1 gap-3 border-t border-[#E6D2BD] bg-[#FFF8F1] p-5 sm:grid-cols-2 sm:p-6">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="min-h-13 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-5 py-3.5 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-5 py-3.5 text-base font-extrabold text-white transition hover:bg-[#E85F08] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      {editingProduct ? "Save Changes" : "Add Product"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Modal */}
        {showCameraModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3">
            <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-[#FFF8F1] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E6D2BD] px-5 py-4">
                <div>
                  <h3 className="text-xl font-extrabold text-[#1F1712]">
                    Take Photo
                  </h3>

                  <p className="text-sm font-semibold text-[#7C6D64]">
                    Position the product clearly inside the camera.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCamera}
                  aria-label="Close camera"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="max-h-[65vh] w-full object-contain"
                />

                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="min-h-13 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#FFF0DE] px-4 py-3 text-base font-extrabold text-[#FF6B0A] transition hover:bg-[#FFE3C8]"
                >
                  <RotateCcw size={20} />
                  Switch
                </button>

                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-4 py-3 text-base font-extrabold text-white transition hover:bg-[#E85F08]"
                >
                  <Camera size={20} />
                  Capture
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function InventorySummaryCard({
  label,
  value,
  icon,
  warning = false,
  danger = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
          danger
            ? "bg-red-50 text-red-600"
            : warning
              ? "bg-[#FFF0DE] text-[#FF6B0A]"
              : "bg-[#FFF0DE] text-[#FF6B0A]"
        }`}
      >
        {icon}
      </div>

      <p className="text-base font-bold text-[#6F625A]">{label}</p>

      <p
        className={`mt-1 text-3xl font-extrabold ${
          danger
            ? "text-red-600"
            : warning
              ? "text-[#FF6B0A]"
              : "text-[#1F1712]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Product Card
function ProductCard({
  product,
  formatPeso,
  onEdit,
  onDelete,
}: {
  product: Product;
  formatPeso: (value: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLowStock = product.stock_quantity < LOW_STOCK_THRESHOLD;
  const isOutOfStock = product.stock_quantity === 0;

  return (
    <article className="overflow-hidden rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Image */}
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#FFFDF9]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package size={56} className="text-[#FF6B0A]/25" />
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-extrabold leading-snug text-[#1F1712]">
              {product.name}
            </h3>

            <p className="mt-1 text-sm font-bold text-[#7C6D64]">
              {product.category}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-[#FFF0DE] px-3 py-1 text-xs font-extrabold text-[#FF6B0A]">
            {product.category}
          </span>
        </div>

        <p className="mb-4 text-2xl font-extrabold text-[#FF6B0A]">
          {formatPeso(product.price)}
        </p>

        {/* Stock Badge */}
        <div
          className={`mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-extrabold ${
            isOutOfStock
              ? "bg-red-50 text-red-600"
              : isLowStock
                ? "bg-[#FFF0DE] text-[#D35400]"
                : "bg-green-50 text-green-700"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isOutOfStock
                ? "bg-red-500"
                : isLowStock
                  ? "bg-[#FF6B0A]"
                  : "bg-green-600"
            }`}
          />

          {isOutOfStock
            ? "Out of Stock"
            : isLowStock
              ? `Low Stock (${product.stock_quantity})`
              : `${product.stock_quantity} in stock`}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-3 py-3 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
          >
            <Pencil size={18} />
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-base font-extrabold text-red-600 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/15"
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}