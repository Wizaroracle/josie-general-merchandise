import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  PhilippinePeso,
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
  const today = format(new Date(), "MMMM d, yyyy");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const todayDate = format(new Date(), "yyyy-MM-dd");

    // Today's sales
    const { data: todaySalesData } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("sale_date", todayDate);

    const todaySales =
      todaySalesData?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0;
    const todayTransactions = todaySalesData?.length ?? 0;

    // Total products
    const { count: totalProducts } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });

    // Low stock items (below 5)
    const { data: lowStockItems } = await supabase
      .from("products")
      .select("name, stock_quantity")
      .lt("stock_quantity", 5)
      .order("stock_quantity", { ascending: true });

    // Weekly sales data (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, "yyyy-MM-dd");
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
      topProducts: [],
    });
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0F172A]">Dashboard</h1>
          <p className="text-[#64748B] mt-1 text-base">{today}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-[#64748B] hover:border-blue-500 hover:text-blue-500 transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          icon={<PhilippinePeso size={24} />}
          label="Today's Sales"
          value={`₱${stats.todaySales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          color="blue"
        />
        <StatCard
          icon={<ShoppingBag size={24} />}
          label="Transactions Today"
          value={stats.todayTransactions.toString()}
          color="green"
        />
        <StatCard
          icon={<Package size={24} />}
          label="Total Products"
          value={stats.totalProducts.toString()}
          color="purple"
        />
        <StatCard
          icon={<AlertTriangle size={24} />}
          label="Low Stock Items"
          value={stats.lowStockCount.toString()}
          color={stats.lowStockCount > 0 ? "red" : "green"}
        />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-3 gap-5">
        {/* Weekly Sales Chart */}
        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-blue-500" />
            <h2 className="text-lg font-bold text-[#0F172A]">
              Sales This Week
            </h2>
          </div>
          {stats.weeklyData.every((d) => d.sales === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-[#64748B]">
              <TrendingUp size={40} className="mb-3 opacity-30" />
              <p className="text-base">No sales recorded yet</p>
              <p className="text-sm mt-1">
                Start recording sales to see your chart
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.weeklyData}>
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 13, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${v}`}
                />
                <Tooltip
                  formatter={(value) => {
                    if (typeof value !== "number") return ["₱0", "Sales"];

                    return [`₱${value.toLocaleString()}`, "Sales"];
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-[#0F172A]">
              Low Stock Alert
            </h2>
          </div>
          {stats.lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#64748B]">
              <Package size={36} className="mb-3 opacity-30" />
              <p className="text-sm text-center">All items are well stocked!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.lowStockItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100"
                >
                  <p className="text-sm font-medium text-[#0F172A] truncate pr-2">
                    {item.name}
                  </p>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      item.stock_quantity === 0
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-600"
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
    </div>
  );
}

// Stat Card Component
const colorMap = {
  blue: { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-500" },
  green: { bg: "bg-green-50", icon: "bg-green-500", text: "text-green-500" },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-500",
    text: "text-purple-500",
  },
  red: { bg: "bg-red-50", icon: "bg-red-500", text: "text-red-500" },
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: keyof typeof colorMap;
}) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div
        className={`w-12 h-12 ${c.icon} rounded-xl flex items-center justify-center text-white mb-4`}
      >
        {icon}
      </div>
      <p className="text-[#64748B] text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-[#0F172A] mt-1">{value}</p>
    </div>
  );
}
