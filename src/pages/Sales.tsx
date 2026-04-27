import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Package,
  ShoppingBag,
  Download,
  X,
  Receipt,
  RefreshCw,
} from "lucide-react";

applyPlugin(jsPDF);

interface SaleWithItems {
  id: string;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  sale_date: string;
  created_at: string;
  recorded_by_name: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

const todayStr = () => new Date().toLocaleDateString("en-CA");

const paymentColor: Record<string, string> = {
  Cash: "bg-green-50 text-green-700 border-green-100",
  GCash: "bg-blue-50 text-blue-700 border-blue-100",
  Maya: "bg-purple-50 text-purple-700 border-purple-100",
  Card: "bg-[#FFF0DE] text-[#FF6B0A] border-[#F6C89A]",
};

export default function Sales() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(todayStr());
  const [search, setSearch] = useState("");

  const formatPeso = (value: number) => {
    return `₱${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const displayDate = useMemo(() => {
    return format(new Date(dateFilter + "T00:00:00"), "MMMM d, yyyy");
  }, [dateFilter]);

  const fetchSales = useCallback(
    async (refreshOnly = false) => {
      if (refreshOnly) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(
          `
          id,
          total_amount,
          payment_method,
          notes,
          sale_date,
          created_at,
          profiles:recorded_by (full_name),
          sale_items (
            quantity,
            unit_price,
            subtotal,
            products (name)
          )
        `,
        )
        .eq("sale_date", dateFilter)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setSales([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const formatted: SaleWithItems[] = (salesData ?? []).map((sale: any) => {
        const profile = Array.isArray(sale.profiles)
          ? sale.profiles[0]
          : sale.profiles;

        return {
          id: sale.id,
          total_amount: Number(sale.total_amount ?? 0),
          payment_method: sale.payment_method,
          notes: sale.notes,
          sale_date: sale.sale_date,
          created_at: sale.created_at,
          recorded_by_name: profile?.full_name ?? "Unknown",
          items: (sale.sale_items ?? []).map((item: any) => {
            const product = Array.isArray(item.products)
              ? item.products[0]
              : item.products;

            return {
              product_name: product?.name ?? "Deleted Product",
              quantity: Number(item.quantity ?? 0),
              unit_price: Number(item.unit_price ?? 0),
              subtotal: Number(item.subtotal ?? 0),
            };
          }),
        };
      });

      setSales(formatted);
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [dateFilter],
  );

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;

    const keyword = search.toLowerCase().trim();

    return sales.filter((sale) => {
      const matchesPayment = sale.payment_method
        .toLowerCase()
        .includes(keyword);

      const matchesRecorder = sale.recorded_by_name
        .toLowerCase()
        .includes(keyword);

      const matchesNotes = sale.notes?.toLowerCase().includes(keyword);

      const matchesProduct = sale.items.some((item) =>
        item.product_name.toLowerCase().includes(keyword),
      );

      return (
        matchesPayment || matchesRecorder || matchesNotes || matchesProduct
      );
    });
  }, [sales, search]);

  const totalSales = useMemo(() => {
    return sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  }, [sales]);

  const totalItemsSold = useMemo(() => {
    return sales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
  }, [sales]);

  const filteredTotal = useMemo(() => {
    return filtered.reduce((sum, sale) => sum + sale.total_amount, 0);
  }, [filtered]);

  const filteredItemsSold = useMemo(() => {
    return filtered.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
  }, [filtered]);

  const downloadPDF = () => {
    if (filtered.length === 0) return;

    const doc = new jsPDF() as any;

    doc.setTextColor(31, 23, 18);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Jonel General Merchandise", 14, 20);

    doc.setFontSize(14);
    doc.text("Daily Sales Report", 14, 28);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 88, 80);
    doc.text(`Date: ${displayDate}`, 14, 37);
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, 14, 43);

    if (search.trim()) {
      doc.text(`Search Filter: ${search.trim()}`, 14, 49);
    }

    doc.setTextColor(31, 23, 18);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, search.trim() ? 61 : 55);

    doc.autoTable({
      startY: search.trim() ? 65 : 59,
      head: [["Metric", "Value"]],
      body: [
        [
          "Total Sales",
          `PHP ${filteredTotal.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}`,
        ],
        ["Transactions", filtered.length.toString()],
        ["Items Sold", filteredItemsSold.toString()],
        [
          "Average per Transaction",
          `PHP ${(filtered.length > 0
            ? filteredTotal / filtered.length
            : 0
          ).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}`,
        ],
      ],
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [255, 107, 10],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [255, 248, 241],
      },
    });

    const y1 = doc.lastAutoTable.finalY + 12;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 23, 18);
    doc.text("Sales Transactions", 14, y1);

    const transactionBodyData = filtered.map((sale) => [
      format(new Date(sale.created_at), "h:mm a"),
      sale.items
        .map((item) => `${item.product_name} x${item.quantity}`)
        .join(", "),
      sale.payment_method,
      sale.recorded_by_name,
      `PHP ${sale.total_amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })}`,
    ]);

    doc.autoTable({
      startY: y1 + 4,
      head: [["Time", "Items", "Payment", "Recorded By", "Amount"]],
      body: transactionBodyData,
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [255, 107, 10],
        textColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [255, 248, 241],
      },
      foot: [
        [
          "TOTAL",
          "",
          "",
          "",
          `PHP ${filteredTotal.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}`,
        ],
      ],
      footStyles: {
        fillColor: [255, 240, 222],
        textColor: [31, 23, 18],
        fontStyle: "bold",
      },
    });

    const paymentMap: Record<string, { count: number; total: number }> = {};

    filtered.forEach((sale) => {
      const method = sale.payment_method;

      if (!paymentMap[method]) {
        paymentMap[method] = { count: 0, total: 0 };
      }

      paymentMap[method].count++;
      paymentMap[method].total += sale.total_amount;
    });

    if (Object.keys(paymentMap).length > 0) {
      const y2 = doc.lastAutoTable.finalY + 12;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 23, 18);
      doc.text("Payment Methods", 14, y2);

      const paymentBodyData = Object.entries(paymentMap).map(
        ([method, data]) => [
          method,
          data.count.toString(),
          `PHP ${data.total.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
          })}`,
        ],
      );

      doc.autoTable({
        startY: y2 + 4,
        head: [["Method", "Count", "Total"]],
        body: paymentBodyData,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [255, 107, 10],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [255, 248, 241],
        },
      });
    }

    doc.save(`sales-report-${dateFilter}.pdf`);
  };

  if (isLoading) {
    return <SalesLoading />;
  }

  return (
    <main className="h-full overflow-hidden bg-[#F6F0EA] p-3 text-[#1F1712] sm:p-4 lg:p-5">
      <div className="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-4">
        {/* Header */}
        <section className="rounded-[22px] border border-[#E6D2BD] bg-[#F8F2EC] p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1712] sm:text-3xl">
                Sales Log
              </h1>

              <p className="mt-0.5 text-sm font-semibold text-[#6F625A] sm:text-base">
                View and track all recorded sales.
              </p>
            </div>

            {/* Compact tablet-friendly filters */}
            <div className="grid grid-cols-[minmax(150px,1fr)_auto_auto_auto] gap-2">
              <div className="relative min-w-0">
                <Calendar
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C6D64]"
                />

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => {
                    setExpandedId(null);
                    setDateFilter(event.target.value);
                  }}
                  className="min-h-[46px] w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] py-2.5 pl-10 pr-3 text-sm font-extrabold text-[#1F1712] outline-none transition focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15"
                />
              </div>

              <button
                type="button"
                onClick={() => setDateFilter(todayStr())}
                className={`min-h-[46px] rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                  dateFilter === todayStr()
                    ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20"
                    : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => void fetchSales(true)}
                disabled={isRefreshing}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-2.5 text-sm font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
              >
                <RefreshCw
                  size={18}
                  className={isRefreshing ? "animate-spin" : ""}
                />
                <span className="hidden sm:inline">
                  {isRefreshing ? "Refreshing" : "Refresh"}
                </span>
              </button>

              <button
                type="button"
                onClick={downloadPDF}
                disabled={filtered.length === 0}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-[#FF6B0A]/20 transition hover:bg-[#E85F08] disabled:cursor-not-allowed disabled:bg-[#D8C8B8] disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
              >
                <Download size={18} />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>
        </section>

        {/* Summary Cards - always same row */}
        <section className="grid grid-cols-3 gap-3">
          <SummaryCard
            icon={<Receipt size={21} />}
            label={dateFilter === todayStr() ? "Today's Sales" : "Total Sales"}
            value={formatPeso(totalSales)}
          />

          <SummaryCard
            icon={<ShoppingBag size={21} />}
            label="Transactions"
            value={sales.length.toString()}
          />

          <SummaryCard
            icon={<Package size={21} />}
            label="Items Sold"
            value={totalItemsSold.toString()}
          />
        </section>

        {/* Search */}
        <section className="rounded-[22px] border border-[#E6D2BD] bg-[#FFF8F1] p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7C6D64]"
              />

              <input
                type="text"
                placeholder="Search product, payment, cashier, or notes..."
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

            <div className="flex flex-col gap-1 text-xs font-bold text-[#7C6D64] sm:flex-row sm:items-center sm:justify-between">
              <p>{displayDate}</p>

              <p>
                Showing {filtered.length} of {sales.length} transaction
                {sales.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </section>

        {/* Sales List - only this area scrolls */}
        <section className="min-h-0 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <EmptyState
              hasSales={sales.length > 0}
              isToday={dateFilter === todayStr()}
            />
          ) : (
            <div className="space-y-3 pb-2">
              {filtered.map((sale, index) => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  index={filtered.length - index}
                  isExpanded={expandedId === sale.id}
                  formatPeso={formatPeso}
                  onToggle={() =>
                    setExpandedId(expandedId === sale.id ? null : sale.id)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[20px] border border-[#E6D2BD] bg-[#FFF8F1] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-4">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
        {icon}
      </div>

      <p className="truncate text-xs font-extrabold text-[#6F625A] sm:text-sm">
        {label}
      </p>

      <p
        className="mt-1 truncate text-xl font-extrabold leading-tight text-[#1F1712] sm:text-2xl"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function SaleCard({
  sale,
  index,
  isExpanded,
  formatPeso,
  onToggle,
}: {
  sale: SaleWithItems;
  index: number;
  isExpanded: boolean;
  formatPeso: (value: number) => string;
  onToggle: () => void;
}) {
  const itemSummary = sale.items
    .map((item) => `${item.product_name} x${item.quantity}`)
    .join(", ");

  return (
    <article className="overflow-hidden rounded-[20px] border border-[#E6D2BD] bg-[#FFF8F1] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left transition hover:bg-[#FFF0DE]/40 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/15 sm:p-4"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
              <span className="text-xs font-extrabold">#{index}</span>
            </div>

            <div className="hidden min-w-0 md:block">
              <p className="text-sm font-extrabold text-[#1F1712]">
                {new Date(sale.created_at).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>

              <p className="truncate text-xs font-semibold text-[#7C6D64]">
                {sale.recorded_by_name}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 md:hidden">
              <p className="text-sm font-extrabold text-[#1F1712]">
                {new Date(sale.created_at).toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>

              <p className="text-xs font-semibold text-[#7C6D64]">
                {sale.recorded_by_name}
              </p>
            </div>

            <p className="line-clamp-2 text-sm font-bold leading-snug text-[#3B312A] sm:text-base">
              {itemSummary}
            </p>

            {sale.notes && (
              <p className="mt-1 line-clamp-1 text-xs font-semibold italic text-[#7C6D64]">
                Note: {sale.notes}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-xs font-extrabold sm:inline-flex ${
                paymentColor[sale.payment_method] ??
                "border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A]"
              }`}
            >
              {sale.payment_method}
            </span>

            <p className="text-right text-base font-extrabold text-[#FF6B0A] sm:text-lg">
              {formatPeso(sale.total_amount)}
            </p>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFFDF9] text-[#6F625A]">
              {isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${
              paymentColor[sale.payment_method] ??
              "border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A]"
            }`}
          >
            {sale.payment_method}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[#E6D2BD] bg-[#FFFDF9] px-3 py-3 sm:px-4">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#6F625A]">
            Items Sold
          </p>

          <div className="space-y-2">
            {sale.items.map((item, index) => (
              <div
                key={`${item.product_name}-${index}`}
                className="rounded-2xl border border-[#E6D2BD] bg-[#FFF8F1] p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0DE] text-[#FF6B0A]">
                      <Package size={17} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-extrabold text-[#1F1712] sm:text-base">
                        {item.product_name}
                      </p>

                      <p className="text-xs font-semibold text-[#7C6D64] sm:text-sm">
                        Quantity: {item.quantity} ×{" "}
                        {formatPeso(item.unit_price)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs font-bold text-[#7C6D64]">Subtotal</p>

                    <p className="text-base font-extrabold text-[#FF6B0A]">
                      {formatPeso(item.subtotal)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#E6D2BD] bg-[#FFF0DE] px-4 py-3">
            <span className="text-sm font-extrabold text-[#6F625A]">Total</span>

            <span className="text-lg font-extrabold text-[#1F1712]">
              {formatPeso(sale.total_amount)}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({
  hasSales,
  isToday,
}: {
  hasSales: boolean;
  isToday: boolean;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#E6D2BD] bg-[#FFF8F1] px-5 text-center shadow-sm">
      <ShoppingBag size={54} className="mb-4 text-[#FF6B0A]/35" />

      <p className="text-2xl font-extrabold text-[#1F1712]">
        {hasSales ? "No matching sales found" : "No sales recorded"}
      </p>

      <p className="mt-2 max-w-md text-base font-medium text-[#6F625A]">
        {hasSales
          ? "Try searching for another product, payment method, cashier, or note."
          : isToday
            ? "No sales yet today. Go to New Sale to record your first transaction."
            : "No sales were recorded for this date."}
      </p>
    </div>
  );
}

function SalesLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-[#F6F0EA] p-6">
      <div className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[28px] border border-[#E6D2BD] bg-[#FFF8F1] px-8 py-8 text-center shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#FF6B0A]" />

        <div className="relative mb-2 flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-[#FFE3C8] border-t-[#FF6B0A]" />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0DE]">
            <Receipt size={30} className="text-[#FF6B0A]" />
          </div>
        </div>

        <p className="text-xl font-extrabold text-[#1F1712]">Loading sales</p>

        <p className="mt-1 text-sm font-semibold text-[#7C6D64]">
          Please wait while we prepare your sales log.
        </p>

        <div className="mt-5 flex gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#FF6B0A] [animation-delay:-0.3s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#FF6B0A] [animation-delay:-0.15s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#FF6B0A]" />
        </div>
      </div>
    </div>
  );
}
