import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  RefreshCw,
  Sun,
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
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockCount: 0,
    weeklyData: [],
    lowStockItems: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = format(now, "EEEE, MMMM d, yyyy");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const todayDate = new Date().toLocaleDateString("en-CA");

    const { data: todaySalesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("sale_date", todayDate);

    const todaySales =
      todaySalesData?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0;
    const todayTransactions = todaySalesData?.length ?? 0;

    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .or("is_deleted.eq.false,is_deleted.is.null");

    const { data: lowStockItems } = await supabase
      .from("products")
      .select("name, stock_quantity")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .lt("stock_quantity", 5)
      .order("stock_quantity", { ascending: true });

    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-CA");
      const dayLabel = format(date, "EEE");
      const { data: daySales } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("sale_date", dateStr);
      const total = daySales?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0;
      weeklyData.push({ day: dayLabel, sales: total });
    }

    setStats({
      todaySales,
      todayTransactions,
      totalProducts: totalProducts ?? 0,
      lowStockCount: lowStockItems?.length ?? 0,
      weeklyData,
      lowStockItems: lowStockItems ?? [],
    });
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F5F0EB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#6B5E52] text-sm font-medium">
            Loading your store data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F5F0EB] p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
            <Sun size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#2C2416]">
              {greeting}! 👋
            </h1>
            <p className="text-[#8C7B6E] mt-0.5 text-sm font-bold">{today}</p>
          </div>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-[#E8DDD4] rounded-2xl text-sm font-medium text-[#6B5E52] hover:border-orange-300 hover:text-orange-500 transition-all shadow-sm"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          icon="₱"
          label="Today's Sales"
          value={`₱${stats.todaySales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          color="orange"
          sub={`${stats.todayTransactions} transaction${stats.todayTransactions !== 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<ShoppingBag size={22} />}
          label="Transactions"
          value={stats.todayTransactions.toString()}
          color="teal"
          sub="recorded today"
        />
        <StatCard
          icon={<Package size={22} />}
          label="Total Products"
          value={stats.totalProducts.toString()}
          color="slate"
          sub="in inventory"
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          label="Low Stock"
          value={stats.lowStockCount.toString()}
          color={stats.lowStockCount > 0 ? "red" : "green"}
          sub={stats.lowStockCount > 0 ? "items need attention" : "all good!"}
        />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-3 gap-5">
        {/* Weekly Chart */}
        <div className="col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-[#EDE5DC]">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2C2416]">
                Sales This Week
              </h2>
              <p className="text-xs text-[#8C7B6E]">Last 7 days overview</p>
            </div>
          </div>

          {stats.weeklyData.every((d) => d.sales === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#8C7B6E]">
              <TrendingUp size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">No sales recorded yet</p>
              <p className="text-xs mt-1 text-[#B09E90]">
                Start recording sales to see your chart
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={stats.weeklyData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#FB923C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FB923C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0E8E0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#8C7B6E" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#8C7B6E" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${v.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: any) => [
                    `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
                    "Sales",
                  ]}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #EDE5DC",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    backgroundColor: "#fff",
                  }}
                  labelStyle={{ color: "#2C2416", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#FB923C"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ fill: "#FB923C", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "#EA580C" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#EDE5DC]">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2C2416]">
                Low Stock Alert
              </h2>
              <p className="text-xs text-[#8C7B6E]">Items running low</p>
            </div>
          </div>

          {stats.lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#8C7B6E]">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-3">
                <Package size={28} className="text-green-400" />
              </div>
              <p className="text-sm font-medium text-[#2C2416]">All good!</p>
              <p className="text-xs mt-1 text-center text-[#B09E90]">
                All items are well stocked
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-52">
              {stats.lowStockItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl border border-amber-100"
                >
                  <p className="text-sm font-medium text-[#2C2416] truncate pr-2">
                    {item.name}
                  </p>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      item.stock_quantity === 0
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.stock_quantity === 0
                      ? "Out of stock"
                      : `${item.stock_quantity} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Summary Footer */}
      <div className="bg-white rounded-3xl p-6 border border-[#EDE5DC] shadow-sm">
        <h2 className="text-base font-bold text-[#2C2416] mb-4">
          Today at a Glance
        </h2>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <span className="text-orange-500 font-bold text-base">₱</span>
            </div>
            <div>
              <p className="text-xs text-[#8C7B6E]">Total Revenue</p>
              <p className="text-lg font-bold text-[#2C2416]">
                ₱
                {stats.todaySales.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          <div className="w-px h-10 bg-[#EDE5DC]" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <ShoppingBag size={18} className="text-teal-500" />
            </div>
            <div>
              <p className="text-xs text-[#8C7B6E]">Transactions</p>
              <p className="text-lg font-bold text-[#2C2416]">
                {stats.todayTransactions}
              </p>
            </div>
          </div>
          <div className="w-px h-10 bg-[#EDE5DC]" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <Package size={18} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-[#8C7B6E]">Avg per Transaction</p>
              <p className="text-lg font-bold text-[#2C2416]">
                ₱
                {stats.todayTransactions > 0
                  ? (stats.todaySales / stats.todayTransactions).toLocaleString(
                      "en-PH",
                      { minimumFractionDigits: 2 },
                    )
                  : "0.00"}
              </p>
            </div>
          </div>
          <div className="w-px h-10 bg-[#EDE5DC]" />
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.lowStockCount > 0 ? "bg-red-50" : "bg-green-50"}`}
            >
              <AlertTriangle
                size={18}
                className={
                  stats.lowStockCount > 0 ? "text-red-500" : "text-green-500"
                }
              />
            </div>
            <div>
              <p className="text-xs text-[#8C7B6E]">Low Stock Items</p>
              <p
                className={`text-lg font-bold ${stats.lowStockCount > 0 ? "text-red-500" : "text-green-500"}`}
              >
                {stats.lowStockCount} {stats.lowStockCount > 0 ? "⚠️" : "✅"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card
const colorMap = {
  orange: {
    bg: "bg-orange-50",
    icon: "bg-orange-400",
    text: "text-orange-500",
    border: "border-orange-100",
    glow: "shadow-orange-100",
  },
  teal: {
    bg: "bg-teal-50",
    icon: "bg-teal-500",
    text: "text-teal-500",
    border: "border-teal-100",
    glow: "shadow-teal-100",
  },
  slate: {
    bg: "bg-slate-100",
    icon: "bg-slate-500",
    text: "text-slate-500",
    border: "border-slate-100",
    glow: "shadow-slate-100",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-400",
    text: "text-red-500",
    border: "border-red-100",
    glow: "shadow-red-100",
  },
  green: {
    bg: "bg-green-50",
    icon: "bg-green-500",
    text: "text-green-500",
    border: "border-green-100",
    glow: "shadow-green-100",
  },
};

function StatCard({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: keyof typeof colorMap;
  sub?: string;
}) {
  const c = colorMap[color];
  return (
    <div
      className={`bg-white rounded-3xl p-6 shadow-sm border ${c.border} hover:shadow-md transition-all`}
    >
      <div
        className={`w-11 h-11 ${c.icon} rounded-2xl flex items-center justify-center text-white mb-4 text-lg font-bold shadow-lg ${c.glow}`}
      >
        {icon}
      </div>
      <p className="text-[#8C7B6E] text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-[#2C2416] mt-1">{value}</p>
      {sub && <p className="text-xs text-[#B09E90] mt-1">{sub}</p>}
    </div>
  );
}
