import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  subWeeks,
  addWeeks,
  subMonths,
  addMonths,
  subYears,
  addYears,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Download,
  TrendingUp,
  ShoppingBag,
  Package,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";

applyPlugin(jsPDF);

type ReportPeriod = "weekly" | "monthly" | "annual";

interface ReportData {
  totalSales: number;
  totalTransactions: number;
  totalItemsSold: number;
  chartData: { label: string; sales: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  paymentBreakdown: { method: string; count: number; total: number }[];
  dailySales: { date: string; total: number; transactions: number }[];
}

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    fetchReport();
  }, [period, selectedDate]);

  const getDateRange = () => {
    if (period === "weekly") {
      return {
        start: format(
          startOfWeek(selectedDate, { weekStartsOn: 1 }),
          "yyyy-MM-dd",
        ),
        end: format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    if (period === "monthly") {
      return {
        start: format(startOfMonth(selectedDate), "yyyy-MM-dd"),
        end: format(endOfMonth(selectedDate), "yyyy-MM-dd"),
      };
    }
    return {
      start: format(startOfYear(selectedDate), "yyyy-MM-dd"),
      end: format(endOfYear(selectedDate), "yyyy-MM-dd"),
    };
  };

  const fetchReport = async () => {
    setIsLoading(true);
    const { start, end } = getDateRange();

    const { data: salesData } = await supabase
      .from("sales")
      .select(
        `id, total_amount, payment_method, sale_date,
        sale_items (quantity, subtotal, products (name))`,
      )
      .gte("sale_date", start)
      .lte("sale_date", end)
      .order("sale_date");

    if (!salesData) {
      setIsLoading(false);
      return;
    }

    const totalSales = salesData.reduce((s, x) => s + x.total_amount, 0);
    const totalTransactions = salesData.length;
    const totalItemsSold = salesData.reduce(
      (s, x) =>
        s + x.sale_items.reduce((a: number, i: any) => a + i.quantity, 0),
      0,
    );

    // Chart data
    let chartData: { label: string; sales: number }[] = [];

    if (period === "weekly") {
      const days = eachDayOfInterval({
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      });
      chartData = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const daySales = salesData.filter((s) => s.sale_date === dayStr);
        return {
          label: format(day, "EEE, MMM d"),
          sales: daySales.reduce((s, x) => s + x.total_amount, 0),
        };
      });
    } else if (period === "monthly") {
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });
      chartData = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const daySales = salesData.filter((s) => s.sale_date === dayStr);
        return {
          label: format(day, "d"),
          sales: daySales.reduce((s, x) => s + x.total_amount, 0),
        };
      });
    } else {
      const months = eachMonthOfInterval({
        start: startOfYear(selectedDate),
        end: endOfYear(selectedDate),
      });
      chartData = months.map((month) => {
        const mStart = format(startOfMonth(month), "yyyy-MM-dd");
        const mEnd = format(endOfMonth(month), "yyyy-MM-dd");
        const mSales = salesData.filter(
          (s) => s.sale_date >= mStart && s.sale_date <= mEnd,
        );
        return {
          label: format(month, "MMMM"),
          sales: mSales.reduce((s, x) => s + x.total_amount, 0),
        };
      });
    }

    // Top products
    const productMap: Record<string, { quantity: number; revenue: number }> =
      {};
    salesData.forEach((sale) => {
      sale.sale_items.forEach((item: any) => {
        const name = item.products?.name ?? "Unknown";
        if (!productMap[name]) productMap[name] = { quantity: 0, revenue: 0 };
        productMap[name].quantity += item.quantity;
        productMap[name].revenue += item.subtotal;
      });
    });
    const topProducts = Object.entries(productMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment breakdown
    const paymentMap: Record<string, { count: number; total: number }> = {};
    salesData.forEach((sale) => {
      const m = sale.payment_method;
      if (!paymentMap[m]) paymentMap[m] = { count: 0, total: 0 };
      paymentMap[m].count++;
      paymentMap[m].total += sale.total_amount;
    });
    const paymentBreakdown = Object.entries(paymentMap)
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total);

    // Daily sales
    const dailyMap: Record<string, { total: number; transactions: number }> =
      {};
    salesData.forEach((sale) => {
      if (!dailyMap[sale.sale_date])
        dailyMap[sale.sale_date] = { total: 0, transactions: 0 };
      dailyMap[sale.sale_date].total += sale.total_amount;
      dailyMap[sale.sale_date].transactions++;
    });
    const dailySales = Object.entries(dailyMap)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setData({
      totalSales,
      totalTransactions,
      totalItemsSold,
      chartData,
      topProducts,
      paymentBreakdown,
      dailySales,
    });
    setIsLoading(false);
  };

  const navigate = (direction: "prev" | "next") => {
    if (period === "weekly") {
      direction === "prev"
        ? setSelectedDate(subWeeks(selectedDate, 1))
        : setSelectedDate(addWeeks(selectedDate, 1));
    } else if (period === "monthly") {
      direction === "prev"
        ? setSelectedDate(subMonths(selectedDate, 1))
        : setSelectedDate(addMonths(selectedDate, 1));
    } else {
      direction === "prev"
        ? setSelectedDate(subYears(selectedDate, 1))
        : setSelectedDate(addYears(selectedDate, 1));
    }
  };

  const periodLabel = () => {
    if (period === "weekly") {
      const s = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const e = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(s, "MMMM d")} – ${format(e, "MMMM d, yyyy")}`;
    }
    if (period === "monthly") return format(selectedDate, "MMMM yyyy");
    return format(selectedDate, "yyyy");
  };

  // Calendar
  const renderCalendar = () => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();

    return (
      <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50 w-80">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-bold text-[#0F172A]">
            {format(calendarMonth, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-[#64748B] py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const isSelected =
              format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            const isToday =
              format(day, "yyyy-MM-dd") ===
              new Date().toLocaleDateString("en-CA");
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  setShowCalendar(false);
                }}
                className={`aspect-square rounded-xl text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-blue-500 text-white"
                    : isToday
                      ? "bg-blue-50 text-blue-600 font-bold"
                      : "hover:bg-gray-100 text-[#0F172A]"
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            setSelectedDate(new Date());
            setShowCalendar(false);
          }}
          className="w-full mt-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
        >
          Today
        </button>
      </div>
    );
  };

  const peso = (v: number) =>
    "PHP " + v.toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const downloadPDF = () => {
    if (!data) return;
    const { start, end } = getDateRange();
    const doc = new jsPDF() as any;

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Mom's Store — Sales Report", 14, 22);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(
      `Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`,
      14,
      32,
    );
    doc.text(
      `Date Range: ${format(new Date(start + "T00:00:00"), "MMMM d, yyyy")} to ${format(new Date(end + "T00:00:00"), "MMMM d, yyyy")}`,
      14,
      39,
    );
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, 14, 46);
    doc.setTextColor(0);

    // Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 58);

    doc.autoTable({
      startY: 62,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sales", peso(data.totalSales)],
        ["Total Transactions", data.totalTransactions.toString()],
        ["Total Items Sold", data.totalItemsSold.toString()],
        [
          "Average per Transaction",
          peso(
            data.totalTransactions > 0
              ? data.totalSales / data.totalTransactions
              : 0,
          ),
        ],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Daily breakdown
    const y1 = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(
      "Daily Breakdown",
      14,
      y1,
    );

    doc.autoTable({
      startY: y1 + 4,
      head: [["Date", "Transactions", "Total Sales"]],
      body: data.dailySales.map((d) => [
        format(new Date(d.date + "T00:00:00"), "MMMM d, yyyy (EEEE)"),
        d.transactions.toString(),
        peso(d.total),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      foot: [
        ["TOTAL", data.totalTransactions.toString(), peso(data.totalSales)],
      ],
      footStyles: {
        fillColor: [239, 246, 255],
        textColor: [30, 41, 59],
        fontStyle: "bold",
      },
    });

    // Top products
    if (data.topProducts.length > 0) {
      const y2 = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Products", 14, y2);

      doc.autoTable({
        startY: y2 + 4,
        head: [["Product", "Qty Sold", "Revenue"]],
        body: data.topProducts.map((p) => [
          p.name,
          p.quantity.toString(),
          peso(p.revenue),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Payment breakdown
    if (data.paymentBreakdown.length > 0) {
      const y3 = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Payment Methods", 14, y3);

      doc.autoTable({
        startY: y3 + 4,
        head: [["Method", "Count", "Total"]],
        body: data.paymentBreakdown.map((p) => [
          p.method,
          p.count.toString(),
          peso(p.total),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    doc.save(`sales-report-${period}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
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
          <h1 className="text-3xl font-bold text-[#0F172A]">Reports</h1>
          <p className="text-[#64748B] mt-1">{periodLabel()}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Prev / Calendar / Next */}
          <div className="flex items-center bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => navigate("prev")}
              className="px-4 py-3 hover:bg-gray-50 text-[#64748B] hover:text-blue-500 transition-colors border-r border-gray-200"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setCalendarMonth(selectedDate);
                  setShowCalendar(!showCalendar);
                }}
                className="flex items-center gap-2 px-5 py-3 hover:bg-gray-50 transition-colors text-sm font-semibold text-[#0F172A]"
              >
                <Calendar size={16} className="text-blue-500" />
                {period === "weekly"
                  ? `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d")}`
                  : period === "monthly"
                    ? format(selectedDate, "MMMM yyyy")
                    : format(selectedDate, "yyyy")}
              </button>
              {showCalendar && renderCalendar()}
            </div>
            <button
              onClick={() => navigate("next")}
              className="px-4 py-3 hover:bg-gray-50 text-[#64748B] hover:text-blue-500 transition-colors border-l border-gray-200"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-5 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold text-[#64748B] hover:border-blue-500 hover:text-blue-500 transition-all"
          >
            Today
          </button>

          {/* Download PDF */}
          <button
            onClick={downloadPDF}
            disabled={!data || data.totalTransactions === 0}
            className="flex items-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-2 mb-8 bg-white border-2 border-gray-200 rounded-2xl p-2 w-fit">
        {(["weekly", "monthly", "annual"] as ReportPeriod[]).map(
          (p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all capitalize ${
                period === p
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-[#64748B] hover:text-blue-500"
              }`}
            >
              {p === "weekly"
                ? "Week"
                : p === "monthly"
                  ? "Month"
                  : "Year"}
            </button>
          ),
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.totalTransactions === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100">
          <BarChart3 size={56} className="mb-4 opacity-20 text-[#64748B]" />
          <p className="text-xl font-medium text-[#0F172A]">
            No data for this period
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            Record some sales to see your report
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-5">
            {[
              {
                label: "Total Sales",
                value: `PHP ${data.totalSales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
              },
              {
                label: "Transactions",
                value: data.totalTransactions.toString(),
              },
              { label: "Items Sold", value: data.totalItemsSold.toString() },
              {
                label: "Avg per Transaction",
                value: `PHP ${(data.totalSales / data.totalTransactions).toFixed(2)}`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
              >
                <p className="text-[#64748B] text-sm font-medium mb-1">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={20} className="text-blue-500" />
              <h2 className="text-lg font-bold text-[#0F172A]">
                Sales Overview
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `PHP ${v.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: any) => [
                    `PHP ${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
                    "Sales",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="sales" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-3 gap-5">
            {/* Top Products */}
            <div className="col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Package size={20} className="text-blue-500" />
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Top Products
                </h2>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="text-[#64748B] text-sm">No product data</p>
              ) : (
                <div className="space-y-4">
                  {data.topProducts.map((product, i) => {
                    const pct = Math.round(
                      (product.revenue / data.totalSales) * 100,
                    );
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-xs font-bold text-blue-600">
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-[#0F172A]">
                              {product.name}
                            </span>
                            <span className="text-xs text-[#64748B]">
                              x{product.quantity} sold
                            </span>
                          </div>
                          <span className="text-sm font-bold text-blue-600">
                            PHP{" "}
                            {product.revenue.toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Breakdown */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingBag size={20} className="text-blue-500" />
                <h2 className="text-lg font-bold text-[#0F172A]">
                  Payment Methods
                </h2>
              </div>
              <div className="space-y-3">
                {data.paymentBreakdown.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          paymentColor[p.method] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.method}
                      </span>
                      <span className="text-xs text-[#64748B]">{p.count}x</span>
                    </div>
                    <span className="text-sm font-bold text-[#0F172A]">
                      PHP{" "}
                      {p.total.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#0F172A] mb-5">
              Breakdown by Day
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide pb-3">
                      Date
                    </th>
                    <th className="text-center text-xs font-semibold text-[#64748B] uppercase tracking-wide pb-3">
                      Transactions
                    </th>
                    <th className="text-right text-xs font-semibold text-[#64748B] uppercase tracking-wide pb-3">
                      Total Sales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailySales.map((day, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 text-sm font-medium text-[#0F172A]">
                        {format(
                          new Date(day.date + "T00:00:00"),
                          "EEEE, MMMM d, yyyy",
                        )}
                      </td>
                      <td className="py-3 text-sm text-center text-[#64748B]">
                        {day.transactions}
                      </td>
                      <td className="py-3 text-sm font-bold text-right text-blue-600">
                        PHP{" "}
                        {day.total.toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td className="pt-3 text-sm font-bold text-[#0F172A]">
                      Total
                    </td>
                    <td className="pt-3 text-sm font-bold text-center text-[#0F172A]">
                      {data.totalTransactions}
                    </td>
                    <td className="pt-3 text-sm font-bold text-right text-blue-600">
                      PHP{" "}
                      {data.totalSales.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close calendar */}
      {showCalendar && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}
