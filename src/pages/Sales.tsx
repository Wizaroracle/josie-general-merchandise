import { useEffect, useState } from "react";
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

export default function Sales() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(todayStr());
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSales();
  }, [dateFilter]);

  const fetchSales = async () => {
    setIsLoading(true);
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

    console.log("error:", error);
    console.log("data:", salesData);

    const formatted: SaleWithItems[] = (salesData ?? []).map((s: any) => ({
      id: s.id,
      total_amount: s.total_amount,
      payment_method: s.payment_method,
      notes: s.notes,
      sale_date: s.sale_date,
      created_at: s.created_at,
      recorded_by_name: s.profiles?.full_name ?? "Unknown",
      items: s.sale_items.map((item: any) => ({
        product_name: item.products?.name ?? "Deleted Product",
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
    }));

    setSales(formatted);
    setIsLoading(false);
  };

  const filtered = sales.filter((s) =>
    search
      ? s.items.some((i) =>
          i.product_name.toLowerCase().includes(search.toLowerCase()),
        ) || s.payment_method.toLowerCase().includes(search.toLowerCase())
      : true,
  );

  const todayTotal = sales.reduce((sum, s) => sum + s.total_amount, 0);

  const downloadPDF = () => {
    const doc = new jsPDF() as any;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Mom's Store — Daily Sales Report", 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const displayDate = format(new Date(dateFilter + "T00:00:00"), "MMMM d, yyyy (EEEE)");
    doc.text(`Date: ${displayDate}`, 14, 32);
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, 14, 39);
    doc.setTextColor(0);

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 51);

    doc.autoTable({
      startY: 55,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sales", `PHP ${todayTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
        ["Total Transactions", sales.length.toString()],
        [
          "Total Items Sold",
          sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0).toString(),
        ],
        [
          "Average per Transaction",
          `PHP ${(sales.length > 0 ? todayTotal / sales.length : 0).toFixed(2)}`,
        ],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Sales Details
    const y1 = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sales Transactions", 14, y1);

    const transactionBodyData = sales.map((sale) => [
      format(new Date(sale.created_at), "h:mm a"),
      sale.items.map((i) => `${i.product_name} x${i.quantity}`).join(", "),
      sale.payment_method,
      sale.recorded_by_name,
      `PHP ${sale.total_amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
    ]);

    doc.autoTable({
      startY: y1 + 4,
      head: [["Time", "Items", "Payment", "Recorded By", "Amount"]],
      body: transactionBodyData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      foot: [
        ["TOTAL", "", "", "", `PHP ${todayTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`],
      ],
      footStyles: {
        fillColor: [239, 246, 255],
        textColor: [30, 41, 59],
        fontStyle: "bold",
      },
    });

    // Payment Breakdown
    const paymentMap: Record<string, { count: number; total: number }> = {};
    sales.forEach((sale) => {
      const method = sale.payment_method;
      if (!paymentMap[method]) paymentMap[method] = { count: 0, total: 0 };
      paymentMap[method].count++;
      paymentMap[method].total += sale.total_amount;
    });

    if (Object.keys(paymentMap).length > 0) {
      const y2 = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Payment Methods", 14, y2);

      const paymentBodyData = Object.entries(paymentMap).map(([method, data]) => [
        method,
        data.count.toString(),
        `PHP ${data.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      ]);

      doc.autoTable({
        startY: y2 + 4,
        head: [["Method", "Count", "Total"]],
        body: paymentBodyData,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    doc.save(`sales-report-${dateFilter}.pdf`);
  };

  const paymentColor: Record<string, string> = {
    Cash: "bg-green-100 text-green-700",
    GCash: "bg-blue-100 text-blue-700",
    Maya: "bg-purple-100 text-purple-700",
    Card: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Sales Log</h1>
          <p className="text-[#64748B] mt-1">
            View and track all recorded sales
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={() => setDateFilter(todayStr())}
            className={`px-5 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
              dateFilter === todayStr()
                ? "bg-blue-500 border-blue-500 text-white"
                : "bg-white border-gray-200 text-[#64748B] hover:border-blue-500 hover:text-blue-500"
            }`}
          >
            Today
          </button>
          <button
            onClick={downloadPDF}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-[#64748B] text-sm font-medium mb-1">
            {dateFilter === todayStr() ? "Today's" : "Total"} Sales
          </p>
          <p className="text-2xl font-bold text-[#0F172A]">
            ₱{todayTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-[#64748B] text-sm font-medium mb-1">
            Transactions
          </p>
          <p className="text-2xl font-bold text-[#0F172A]">{sales.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-[#64748B] text-sm font-medium mb-1">Items Sold</p>
          <p className="text-2xl font-bold text-[#0F172A]">
            {sales.reduce(
              (sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0),
              0,
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]"
        />
        <input
          type="text"
          placeholder="Search by product or payment method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Sales List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100">
          <ShoppingBag size={56} className="mb-4 opacity-20 text-[#64748B]" />
          <p className="text-xl font-medium text-[#0F172A]">
            No sales recorded
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            {dateFilter === todayStr()
              ? "No sales yet today — go record a sale!"
              : "No sales found for this date"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sale, index) => (
            <div
              key={sale.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-left"
                onClick={() =>
                  setExpandedId(expandedId === sale.id ? null : sale.id)
                }
              >
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-blue-600 font-bold text-sm">
                    #{sales.length - index}
                  </span>
                </div>
                <div className="shrink-0">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {new Date(sale.created_at).toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {sale.recorded_by_name}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#64748B] truncate">
                    {sale.items
                      .map((i) => `${i.product_name} x${i.quantity}`)
                      .join(", ")}
                  </p>
                  {sale.notes && (
                    <p className="text-xs text-[#64748B] italic mt-0.5">
                      Note: {sale.notes}
                    </p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    paymentColor[sale.payment_method] ??
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {sale.payment_method}
                </span>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-[#0F172A]">
                    ₱
                    {sale.total_amount.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-[#64748B]">
                  {expandedId === sale.id ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </div>
              </button>

              {expandedId === sale.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                    Items Sold
                  </p>
                  <div className="space-y-2">
                    {sale.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-[#64748B]" />
                          <span className="text-sm text-[#0F172A] font-medium">
                            {item.product_name}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            x{item.quantity}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-[#64748B]">
                            ₱{item.unit_price.toLocaleString()} each →{" "}
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            ₱
                            {item.subtotal.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                    <span className="text-sm font-semibold text-[#64748B]">
                      Total
                    </span>
                    <span className="text-base font-bold text-[#0F172A]">
                      ₱
                      {sale.total_amount.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
