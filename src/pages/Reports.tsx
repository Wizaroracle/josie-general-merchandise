import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  Receipt,
  RefreshCw,
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

const todayStr = () => new Date().toLocaleDateString("en-CA");

const paymentColor: Record<string, string> = {
  Cash: "bg-green-50 text-green-700 border-green-100",
  GCash: "bg-blue-50 text-blue-700 border-blue-100",
  Maya: "bg-purple-50 text-purple-700 border-purple-100",
  Card: "bg-[#FFF0DE] text-[#FF6B0A] border-[#F6C89A]",
};

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const formatPeso = (value: number) => {
    return `₱${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const pesoForPDF = (value: number) => {
    return `PHP ${value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getDateRange = useCallback(() => {
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
  }, [period, selectedDate]);

  const periodLabel = useMemo(() => {
    if (period === "weekly") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });

      return `${format(start, "MMMM d")} – ${format(end, "MMMM d, yyyy")}`;
    }

    if (period === "monthly") {
      return format(selectedDate, "MMMM yyyy");
    }

    return format(selectedDate, "yyyy");
  }, [period, selectedDate]);

  const fetchReport = useCallback(
    async (refreshOnly = false) => {
      if (refreshOnly) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { start, end } = getDateRange();

      const { data: salesData, error } = await supabase
        .from("sales")
        .select(
          `
          id,
          total_amount,
          payment_method,
          sale_date,
          sale_items (
            quantity,
            subtotal,
            products (name)
          )
        `,
        )
        .gte("sale_date", start)
        .lte("sale_date", end)
        .order("sale_date", { ascending: true });

      if (error) {
        console.error(error);
        setData(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const sales = salesData ?? [];

      const totalSales = sales.reduce(
        (sum, sale: any) => sum + Number(sale.total_amount ?? 0),
        0,
      );

      const totalTransactions = sales.length;

      const totalItemsSold = sales.reduce((sum, sale: any) => {
        return (
          sum +
          (sale.sale_items ?? []).reduce(
            (itemSum: number, item: any) =>
              itemSum + Number(item.quantity ?? 0),
            0,
          )
        );
      }, 0);

      let chartData: { label: string; sales: number }[] = [];

      if (period === "weekly") {
        const days = eachDayOfInterval({
          start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
          end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
        });

        chartData = days.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");

          const daySales = sales.filter(
            (sale: any) => sale.sale_date === dayStr,
          );

          return {
            label: format(day, "EEE"),
            sales: daySales.reduce(
              (sum: number, sale: any) => sum + Number(sale.total_amount ?? 0),
              0,
            ),
          };
        });
      } else if (period === "monthly") {
        const days = eachDayOfInterval({
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        });

        chartData = days.map((day) => {
          const dayStr = format(day, "yyyy-MM-dd");

          const daySales = sales.filter(
            (sale: any) => sale.sale_date === dayStr,
          );

          return {
            label: format(day, "d"),
            sales: daySales.reduce(
              (sum: number, sale: any) => sum + Number(sale.total_amount ?? 0),
              0,
            ),
          };
        });
      } else {
        const months = eachMonthOfInterval({
          start: startOfYear(selectedDate),
          end: endOfYear(selectedDate),
        });

        chartData = months.map((month) => {
          const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
          const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

          const monthSales = sales.filter(
            (sale: any) =>
              sale.sale_date >= monthStart && sale.sale_date <= monthEnd,
          );

          return {
            label: format(month, "MMM"),
            sales: monthSales.reduce(
              (sum: number, sale: any) => sum + Number(sale.total_amount ?? 0),
              0,
            ),
          };
        });
      }

      const productMap: Record<string, { quantity: number; revenue: number }> =
        {};

      sales.forEach((sale: any) => {
        (sale.sale_items ?? []).forEach((item: any) => {
          const product = Array.isArray(item.products)
            ? item.products[0]
            : item.products;

          const name = product?.name ?? "Deleted Product";

          if (!productMap[name]) {
            productMap[name] = { quantity: 0, revenue: 0 };
          }

          productMap[name].quantity += Number(item.quantity ?? 0);
          productMap[name].revenue += Number(item.subtotal ?? 0);
        });
      });

      const topProducts = Object.entries(productMap)
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const paymentMap: Record<string, { count: number; total: number }> = {};

      sales.forEach((sale: any) => {
        const method = sale.payment_method ?? "Unknown";

        if (!paymentMap[method]) {
          paymentMap[method] = { count: 0, total: 0 };
        }

        paymentMap[method].count += 1;
        paymentMap[method].total += Number(sale.total_amount ?? 0);
      });

      const paymentBreakdown = Object.entries(paymentMap)
        .map(([method, value]) => ({ method, ...value }))
        .sort((a, b) => b.total - a.total);

      const dailyMap: Record<string, { total: number; transactions: number }> =
        {};

      sales.forEach((sale: any) => {
        const saleDate = sale.sale_date;

        if (!dailyMap[saleDate]) {
          dailyMap[saleDate] = { total: 0, transactions: 0 };
        }

        dailyMap[saleDate].total += Number(sale.total_amount ?? 0);
        dailyMap[saleDate].transactions += 1;
      });

      const dailySales = Object.entries(dailyMap)
        .map(([date, value]) => ({ date, ...value }))
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
      setIsRefreshing(false);
    },
    [getDateRange, period, selectedDate],
  );

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const navigate = (direction: "prev" | "next") => {
    setShowCalendar(false);

    if (period === "weekly") {
      setSelectedDate((current) =>
        direction === "prev" ? subWeeks(current, 1) : addWeeks(current, 1),
      );
      return;
    }

    if (period === "monthly") {
      setSelectedDate((current) =>
        direction === "prev" ? subMonths(current, 1) : addMonths(current, 1),
      );
      return;
    }

    setSelectedDate((current) =>
      direction === "prev" ? subYears(current, 1) : addYears(current, 1),
    );
  };

  const selectToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setCalendarMonth(now);
    setShowCalendar(false);
  };

  const downloadPDF = () => {
    if (!data || data.totalTransactions === 0) return;

    const { start, end } = getDateRange();
    const doc = new jsPDF() as any;

    doc.setTextColor(31, 23, 18);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Jonel General Merchandise", 14, 20);

    doc.setFontSize(14);
    doc.text("Sales Report", 14, 28);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 88, 80);
    doc.text(
      `Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`,
      14,
      37,
    );
    doc.text(
      `Date Range: ${format(
        new Date(start + "T00:00:00"),
        "MMMM d, yyyy",
      )} to ${format(new Date(end + "T00:00:00"), "MMMM d, yyyy")}`,
      14,
      43,
    );
    doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, 14, 49);

    doc.setTextColor(31, 23, 18);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, 61);

    doc.autoTable({
      startY: 65,
      head: [["Metric", "Value"]],
      body: [
        ["Total Sales", pesoForPDF(data.totalSales)],
        ["Total Transactions", data.totalTransactions.toString()],
        ["Total Items Sold", data.totalItemsSold.toString()],
        [
          "Average per Transaction",
          pesoForPDF(
            data.totalTransactions > 0
              ? data.totalSales / data.totalTransactions
              : 0,
          ),
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
    doc.text("Daily Breakdown", 14, y1);

    doc.autoTable({
      startY: y1 + 4,
      head: [["Date", "Transactions", "Total Sales"]],
      body: data.dailySales.map((day) => [
        format(new Date(day.date + "T00:00:00"), "MMMM d, yyyy (EEEE)"),
        day.transactions.toString(),
        pesoForPDF(day.total),
      ]),
      styles: {
        fontSize: 9.5,
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
          data.totalTransactions.toString(),
          pesoForPDF(data.totalSales),
        ],
      ],
      footStyles: {
        fillColor: [255, 240, 222],
        textColor: [31, 23, 18],
        fontStyle: "bold",
      },
    });

    if (data.topProducts.length > 0) {
      const y2 = doc.lastAutoTable.finalY + 12;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 23, 18);
      doc.text("Top Products", 14, y2);

      doc.autoTable({
        startY: y2 + 4,
        head: [["Product", "Qty Sold", "Revenue"]],
        body: data.topProducts.map((product) => [
          product.name,
          product.quantity.toString(),
          pesoForPDF(product.revenue),
        ]),
        styles: {
          fontSize: 9.5,
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

    if (data.paymentBreakdown.length > 0) {
      const y3 = doc.lastAutoTable.finalY + 12;

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 23, 18);
      doc.text("Payment Methods", 14, y3);

      doc.autoTable({
        startY: y3 + 4,
        head: [["Method", "Count", "Total"]],
        body: data.paymentBreakdown.map((payment) => [
          payment.method,
          payment.count.toString(),
          pesoForPDF(payment.total),
        ]),
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

    doc.save(`sales-report-${period}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const renderCalendar = () => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();

    return (
      <div className="absolute left-1/2 top-full z-[60] mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-4 shadow-2xl sm:left-auto sm:right-0 sm:translate-x-0">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFFDF9] text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-base font-extrabold text-[#1F1712]">
            {format(calendarMonth, "MMMM yyyy")}
          </span>

          <button
            type="button"
            onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFFDF9] text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-extrabold text-[#7C6D64]"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDay }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}

          {days.map((day) => {
            const isSelected =
              format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");

            const isToday = format(day, "yyyy-MM-dd") === todayStr();

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  setSelectedDate(day);
                  setShowCalendar(false);
                }}
                className={`aspect-square rounded-2xl text-sm font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                  isSelected
                    ? "bg-[#FF6B0A] text-white shadow-md shadow-[#FF6B0A]/20"
                    : isToday
                      ? "bg-[#FFF0DE] text-[#FF6B0A]"
                      : "text-[#3B312A] hover:bg-[#FFF0DE]"
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={selectToday}
          className="mt-4 min-h-11 w-full rounded-2xl bg-[#FFF0DE] px-4 py-2.5 text-base font-extrabold text-[#FF6B0A] transition hover:bg-[#FFE3C8]"
        >
          Today
        </button>
      </div>
    );
  };

  if (isLoading) {
    return <ReportsLoading />;
  }

  return (
    <main className="min-h-full bg-[#F6F0EA] p-4 text-[#1F1712] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[24px] border border-[#E6D2BD] bg-[#F8F2EC] p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1F1712] sm:text-4xl">
                Reports
              </h1>

              <p className="mt-1 text-base font-semibold text-[#6F625A] sm:text-lg">
                {periodLabel}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-center">
              {/* Period Navigator */}
              <div className="flex min-h-[52px] items-center overflow-visible rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] sm:col-span-2 xl:col-span-1">
                <button
                  type="button"
                  onClick={() => navigate("prev")}
                  className="flex min-h-[52px] items-center justify-center border-r border-[#E6D2BD] px-4 text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
                >
                  <ChevronLeft size={22} />
                </button>

                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(selectedDate);
                      setShowCalendar((current) => !current);
                    }}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 px-4 text-base font-extrabold text-[#1F1712] transition hover:bg-[#FFF0DE]"
                  >
                    <Calendar size={20} className="text-[#FF6B0A]" />

                    <span className="truncate">
                      {period === "weekly"
                        ? `Week of ${format(
                            startOfWeek(selectedDate, { weekStartsOn: 1 }),
                            "MMM d",
                          )}`
                        : period === "monthly"
                          ? format(selectedDate, "MMMM yyyy")
                          : format(selectedDate, "yyyy")}
                    </span>
                  </button>

                  {showCalendar && renderCalendar()}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("next")}
                  className="flex min-h-[52px] items-center justify-center border-l border-[#E6D2BD] px-4 text-[#6F625A] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              <button
                type="button"
                onClick={selectToday}
                className={`min-h-[52px] rounded-2xl px-5 py-3 text-base font-extrabold transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                  format(selectedDate, "yyyy-MM-dd") === todayStr()
                    ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20"
                    : "border border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A] hover:border-[#FF6B0A] hover:text-[#FF6B0A]"
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => void fetchReport(true)}
                disabled={isRefreshing}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-5 py-3 text-base font-extrabold text-[#6F625A] transition hover:border-[#FF6B0A] hover:text-[#FF6B0A] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20"
              >
                <RefreshCw
                  size={20}
                  className={isRefreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={downloadPDF}
                disabled={!data || data.totalTransactions === 0}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#FF6B0A] px-5 py-3 text-base font-extrabold text-white shadow-lg shadow-[#FF6B0A]/20 transition hover:bg-[#E85F08] disabled:cursor-not-allowed disabled:bg-[#D8C8B8] disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
              >
                <Download size={20} />
                Download PDF
              </button>
            </div>
          </div>
        </section>

        {/* Period Tabs */}
        <section className="overflow-x-auto">
          <div className="flex w-max gap-2 rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-2 shadow-sm">
            {(["weekly", "monthly", "annual"] as ReportPeriod[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPeriod(item);
                  setShowCalendar(false);
                }}
                className={`min-h-12 rounded-2xl px-7 py-3 text-base font-extrabold capitalize transition-all focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 ${
                  period === item
                    ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20"
                    : "text-[#6F625A] hover:bg-[#FFF0DE] hover:text-[#FF6B0A]"
                }`}
              >
                {item === "weekly"
                  ? "Week"
                  : item === "monthly"
                    ? "Month"
                    : "Year"}
              </button>
            ))}
          </div>
        </section>

        {!data || data.totalTransactions === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={<TrendingUp size={24} />}
                label="Total Sales"
                value={formatPeso(data.totalSales)}
              />

              <SummaryCard
                icon={<Receipt size={24} />}
                label="Transactions"
                value={data.totalTransactions.toString()}
              />

              <SummaryCard
                icon={<Package size={24} />}
                label="Items Sold"
                value={data.totalItemsSold.toString()}
              />

              <SummaryCard
                icon={<ShoppingBag size={24} />}
                label="Avg per Transaction"
                value={formatPeso(
                  data.totalTransactions > 0
                    ? data.totalSales / data.totalTransactions
                    : 0,
                )}
              />
            </section>

            {/* Chart */}
            <section className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
                  <BarChart3 size={23} />
                </div>

                <div>
                  <h2 className="text-xl font-extrabold text-[#1F1712]">
                    Sales Overview
                  </h2>
                  <p className="text-sm font-semibold text-[#7C6D64]">
                    {periodLabel}
                  </p>
                </div>
              </div>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.chartData}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAD8C7" />

                    <XAxis
                      dataKey="label"
                      tick={{
                        fontSize: 12,
                        fill: "#6F625A",
                        fontWeight: 700,
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval={period === "monthly" ? 2 : 0}
                    />

                    <YAxis
                      width={70}
                      tick={{
                        fontSize: 12,
                        fill: "#6F625A",
                        fontWeight: 700,
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        `₱${Number(value).toLocaleString()}`
                      }
                    />

                    <Tooltip
                      formatter={(value: any) => [
                        formatPeso(Number(value)),
                        "Sales",
                      ]}
                      contentStyle={{
                        background: "#FFF8F1",
                        borderRadius: "16px",
                        border: "1px solid #E6D2BD",
                        boxShadow: "0 12px 30px rgba(59, 49, 42, 0.12)",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#1F1712",
                      }}
                      labelStyle={{
                        color: "#6F625A",
                        fontWeight: 800,
                        marginBottom: "6px",
                      }}
                    />

                    <Bar dataKey="sales" fill="#FF6B0A" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Bottom Grid */}
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {/* Top Products */}
              <div className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm sm:p-6 xl:col-span-2">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
                    <Package size={23} />
                  </div>

                  <div>
                    <h2 className="text-xl font-extrabold text-[#1F1712]">
                      Top Products
                    </h2>
                    <p className="text-sm font-semibold text-[#7C6D64]">
                      Best performing items by revenue
                    </p>
                  </div>
                </div>

                {data.topProducts.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#E6D2BD] bg-[#FFFDF9] p-5 text-center text-base font-semibold text-[#6F625A]">
                    No product data available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {data.topProducts.map((product, index) => {
                      const percentage =
                        data.totalSales > 0
                          ? Math.round(
                              (product.revenue / data.totalSales) * 100,
                            )
                          : 0;

                      return (
                        <div
                          key={`${product.name}-${index}`}
                          className="rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] p-4"
                        >
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF0DE] text-sm font-extrabold text-[#FF6B0A]">
                                {index + 1}
                              </span>

                              <div className="min-w-0">
                                <p className="break-words text-base font-extrabold text-[#1F1712]">
                                  {product.name}
                                </p>

                                <p className="text-sm font-semibold text-[#7C6D64]">
                                  {product.quantity} sold
                                </p>
                              </div>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-lg font-extrabold text-[#FF6B0A]">
                                {formatPeso(product.revenue)}
                              </p>
                              <p className="text-sm font-bold text-[#7C6D64]">
                                {percentage}% of sales
                              </p>
                            </div>
                          </div>

                          <div className="h-3 overflow-hidden rounded-full bg-[#FFF0DE]">
                            <div
                              className="h-full rounded-full bg-[#FF6B0A] transition-all"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Breakdown */}
              <div className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
                    <ShoppingBag size={23} />
                  </div>

                  <div>
                    <h2 className="text-xl font-extrabold text-[#1F1712]">
                      Payment Methods
                    </h2>
                    <p className="text-sm font-semibold text-[#7C6D64]">
                      Breakdown by payment type
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {data.paymentBreakdown.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#E6D2BD] bg-[#FFFDF9] p-5 text-center text-base font-semibold text-[#6F625A]">
                      No payment data.
                    </p>
                  ) : (
                    data.paymentBreakdown.map((payment, index) => (
                      <div
                        key={`${payment.method}-${index}`}
                        className="rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-sm font-extrabold ${
                              paymentColor[payment.method] ??
                              "border-[#E6D2BD] bg-[#FFFDF9] text-[#6F625A]"
                            }`}
                          >
                            {payment.method}
                          </span>

                          <span className="text-sm font-bold text-[#7C6D64]">
                            {payment.count} transaction
                            {payment.count === 1 ? "" : "s"}
                          </span>
                        </div>

                        <p className="text-right text-lg font-extrabold text-[#1F1712]">
                          {formatPeso(payment.total)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Daily Breakdown */}
            <section className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm sm:p-6">
              <div className="mb-5">
                <h2 className="text-xl font-extrabold text-[#1F1712]">
                  Breakdown by Day
                </h2>
                <p className="text-sm font-semibold text-[#7C6D64]">
                  Daily sales and transaction count
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9]">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[#E6D2BD] bg-[#FFF0DE]">
                      <th className="px-4 py-4 text-left text-sm font-extrabold uppercase tracking-wide text-[#6F625A]">
                        Date
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wide text-[#6F625A]">
                        Transactions
                      </th>
                      <th className="px-4 py-4 text-right text-sm font-extrabold uppercase tracking-wide text-[#6F625A]">
                        Total Sales
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.dailySales.map((day, index) => (
                      <tr
                        key={`${day.date}-${index}`}
                        className="border-b border-[#E6D2BD] transition hover:bg-[#FFF8F1]"
                      >
                        <td className="px-4 py-4 text-base font-bold text-[#1F1712]">
                          {format(
                            new Date(day.date + "T00:00:00"),
                            "EEEE, MMMM d, yyyy",
                          )}
                        </td>

                        <td className="px-4 py-4 text-center text-base font-bold text-[#6F625A]">
                          {day.transactions}
                        </td>

                        <td className="px-4 py-4 text-right text-base font-extrabold text-[#FF6B0A]">
                          {formatPeso(day.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-[#FFF0DE]">
                      <td className="px-4 py-4 text-base font-extrabold text-[#1F1712]">
                        Total
                      </td>

                      <td className="px-4 py-4 text-center text-base font-extrabold text-[#1F1712]">
                        {data.totalTransactions}
                      </td>

                      <td className="px-4 py-4 text-right text-base font-extrabold text-[#FF6B0A]">
                        {formatPeso(data.totalSales)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Click outside to close calendar */}
      {showCalendar && (
        <button
          type="button"
          aria-label="Close calendar"
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setShowCalendar(false)}
        />
      )}
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
    <div className="rounded-[24px] border border-[#E6D2BD] bg-[#FFF8F1] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
        {icon}
      </div>

      <p className="text-base font-bold text-[#6F625A]">{label}</p>

      <p className="mt-1 break-words text-3xl font-extrabold leading-tight text-[#1F1712]">
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#E6D2BD] bg-[#FFF8F1] px-5 text-center shadow-sm">
      <BarChart3 size={64} className="mb-4 text-[#FF6B0A]/35" />

      <p className="text-2xl font-extrabold text-[#1F1712]">
        No data for this period
      </p>

      <p className="mt-2 max-w-md text-base font-medium text-[#6F625A]">
        Record some sales to see your report here.
      </p>
    </div>
  );
}

function ReportsLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[#F6F0EA] p-6">
      <div className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[28px] border border-[#E6D2BD] bg-[#FFF8F1] px-8 py-8 text-center shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#FF6B0A]" />

        <div className="relative mb-2 flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-[#FFE3C8] border-t-[#FF6B0A]" />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0DE]">
            <BarChart3 size={30} className="text-[#FF6B0A]" />
          </div>
        </div>

        <p className="text-xl font-extrabold text-[#1F1712]">Loading reports</p>

        <p className="mt-1 text-sm font-semibold text-[#7C6D64]">
          Please wait while we prepare your sales report.
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
