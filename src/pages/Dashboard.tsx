import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  PhilippinePeso,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  lowStockCount: number;
  weeklyData: { day: string; sales: number }[];
  lowStockItems: { name: string; stock_quantity: number }[];
  topProducts: { name: string; total_sold: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockCount: 0,
    weeklyData: [],
    lowStockItems: [],
    topProducts: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const today = format(new Date(), "EEEE, MMMM d, yyyy");

  const formatPeso = (amount: number) => {
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const fetchDashboardData = useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setErrorMessage("");

    try {
      const todayDate = format(new Date(), "yyyy-MM-dd");

      const [todaySalesResult, totalProductsResult, lowStockResult] =
        await Promise.all([
          supabase
            .from("sales")
            .select("total_amount")
            .eq("sale_date", todayDate),

          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .or("is_deleted.eq.false,is_deleted.is.null"),

          supabase
            .from("products")
            .select("name, stock_quantity")
            .or("is_deleted.eq.false,is_deleted.is.null")
            .lt("stock_quantity", 5)
            .order("stock_quantity", { ascending: true }),
        ]);

      if (todaySalesResult.error) throw todaySalesResult.error;
      if (totalProductsResult.error) throw totalProductsResult.error;
      if (lowStockResult.error) throw lowStockResult.error;

      const todaySalesData = todaySalesResult.data ?? [];
      const lowStockItems = lowStockResult.data ?? [];

      const todaySales = todaySalesData.reduce(
        (sum, sale) => sum + Number(sale.total_amount ?? 0),
        0,
      );

      const todayTransactions = todaySalesData.length;

      const weeklyData = await Promise.all(
        Array.from({ length: 7 }, async (_, index) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - index));

          const dateStr = format(date, "yyyy-MM-dd");
          const dayLabel = format(date, "EEE");

          const { data: daySales, error } = await supabase
            .from("sales")
            .select("total_amount")
            .eq("sale_date", dateStr);

          if (error) throw error;

          const total =
            daySales?.reduce(
              (sum, sale) => sum + Number(sale.total_amount ?? 0),
              0,
            ) ?? 0;

          return { day: dayLabel, sales: total };
        }),
      );

      setStats({
        todaySales,
        todayTransactions,
        totalProducts: totalProductsResult.count ?? 0,
        lowStockCount: lowStockItems.length,
        weeklyData,
        lowStockItems,
        topProducts: [],
      });
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "We couldn’t load the dashboard data. Please check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData(true);
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F6F0EA] p-6">
        <div className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[28px] border border-[#E6D2BD] bg-[#FFF8F1] px-8 py-8 text-center shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#FF6B0A]" />

          <div className="relative mb-2 flex h-20 w-20 items-center justify-center">
            <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-[#FFE3C8] border-t-[#FF6B0A]" />

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0DE]">
              <Package size={30} className="text-[#FF6B0A]" />
            </div>
          </div>

          <p className="text-xl font-extrabold text-[#1F1712]">
            Loading dashboard
          </p>

          <p className="mt-1 text-sm font-semibold text-[#7C6D64]">
            Please wait while we prepare your data.
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

  const hasNoWeeklySales = stats.weeklyData.every((day) => day.sales === 0);

  return (
    <main className="h-full overflow-hidden bg-[#F6F0EA] p-3 text-[#1F1712] sm:p-4 lg:p-5">
      <div className="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
        {/* Header */}
        <section className="rounded-[22px] border border-[#E6D2BD] bg-[#F8F2EC] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1712] sm:text-3xl">
                Dashboard
              </h1>

              <p className="mt-1 text-sm font-semibold text-[#6F625A] sm:text-base">
                {today}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void fetchDashboardData(false)}
              disabled={isRefreshing}
              aria-label="Refresh dashboard data"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[#E6D2BD] bg-[#FFF8F1] px-5 py-3 text-base font-extrabold text-[#6F625A] transition-all hover:border-[#FF6B0A] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <RefreshCw
                size={20}
                className={isRefreshing ? "animate-spin" : ""}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-[#F7B267] bg-[#FFF0DE] p-3 text-sm font-bold text-[#7A3D00]"
            >
              {errorMessage}
            </div>
          )}
        </section>

        {/* Stat Cards - Always 4 Columns */}
        <section className="grid grid-cols-4 gap-3">
          <StatCard
            icon={<PhilippinePeso size={22} />}
            label="Today's Sales"
            value={formatPeso(stats.todaySales)}
          />

          <StatCard
            icon={<ShoppingBag size={22} />}
            label="Transactions"
            value={stats.todayTransactions.toString()}
          />

          <StatCard
            icon={<Package size={22} />}
            label="Products"
            value={stats.totalProducts.toString()}
          />

          <StatCard
            icon={<AlertTriangle size={22} />}
            label="Low Stock"
            value={stats.lowStockCount.toString()}
            isWarning={stats.lowStockCount > 0}
          />
        </section>

        {/* Chart + Low Stock */}
        <section className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-3">
          {/* Weekly Sales Chart */}
          <div className="flex min-h-0 flex-col rounded-[22px] border border-[#E6D2BD] bg-[#FFF8F1] p-4 shadow-sm md:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
                <TrendingUp size={21} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#1F1712]">
                  Sales This Week
                </h2>
                <p className="text-sm font-semibold text-[#7C6D64]">
                  Last 7 days sales overview
                </p>
              </div>
            </div>

            {hasNoWeeklySales ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E6D2BD] bg-[#FFFDF9] px-4 text-center text-[#6F625A]">
                <TrendingUp size={44} className="mb-3 text-[#FF6B0A]/40" />
                <p className="text-lg font-extrabold text-[#3B312A]">
                  No sales recorded yet
                </p>
                <p className="mt-1 max-w-sm text-sm font-semibold">
                  Start recording sales to see your weekly chart here.
                </p>
              </div>
            ) : (
              <div className="min-h-[220px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.weeklyData}
                    margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#FF6B0A"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="95%"
                          stopColor="#FF6B0A"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#EAD8C7" />

                    <XAxis
                      dataKey="day"
                      tick={{
                        fontSize: 13,
                        fill: "#6F625A",
                        fontWeight: 700,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <YAxis
                      width={58}
                      tick={{
                        fontSize: 13,
                        fill: "#6F625A",
                        fontWeight: 700,
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `₱${value}`}
                    />

                    <Tooltip
                      formatter={(value) => {
                        if (typeof value !== "number") return ["₱0", "Sales"];

                        return [`₱${value.toLocaleString("en-PH")}`, "Sales"];
                      }}
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

                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#FF6B0A"
                      strokeWidth={3}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Low Stock Alert */}
          <div className="flex min-h-0 flex-col rounded-[22px] border border-[#E6D2BD] bg-[#FFF8F1] p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A]">
                <AlertTriangle size={21} />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-[#1F1712]">
                  Low Stock
                </h2>
                <p className="text-sm font-semibold text-[#7C6D64]">
                  Below 5 stocks
                </p>
              </div>
            </div>

            {stats.lowStockItems.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E6D2BD] bg-[#FFFDF9] px-4 text-center">
                <Package size={42} className="mb-3 text-[#FF6B0A]/40" />
                <p className="text-lg font-extrabold text-[#3B312A]">
                  All items are stocked
                </p>
                <p className="mt-1 text-sm font-semibold text-[#6F625A]">
                  No action needed right now.
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {stats.lowStockItems.map((item, index) => {
                  const isOutOfStock = item.stock_quantity === 0;

                  return (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#F3C27A] bg-[#FFF0DE] p-3"
                    >
                      <p className="min-w-0 flex-1 break-words text-sm font-extrabold text-[#1F1712]">
                        {item.name}
                      </p>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${
                          isOutOfStock
                            ? "bg-[#FFE4E6] text-[#DC2626]"
                            : "bg-[#FFE8C7] text-[#D35400]"
                        }`}
                      >
                        {isOutOfStock ? "Out" : `${item.stock_quantity} left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  isWarning = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  isWarning?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[20px] border border-[#E6D2BD] bg-[#FFF8F1] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF0DE] text-[#FF6B0A] sm:h-11 sm:w-11">
        {icon}
      </div>

      <p className="truncate text-xs font-extrabold text-[#6F625A] sm:text-sm">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-xl font-extrabold leading-tight sm:text-2xl ${
          isWarning ? "text-[#FF6B0A]" : "text-[#1F1712]"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
