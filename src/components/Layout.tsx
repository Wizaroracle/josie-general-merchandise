import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  LogOut,
  Store,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/pos", icon: ShoppingCart, label: "New Sale" },
  { to: "/sales", icon: ClipboardList, label: "Sales Log" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1E293B] flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
            <Store size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">
              Mom's Store
            </p>
            <p className="text-white/40 text-xs">Watch & Merchandise</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-4 rounded-xl text-base font-medium transition-all duration-150
                ${
                  isActive
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign Out */}
        <div className="px-4 py-5 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <span className="text-blue-400 font-bold text-sm">
                {profile?.full_name?.charAt(0).toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-sm font-medium truncate">
                {profile?.full_name ?? "User"}
              </p>
              <p className="text-white/40 text-xs capitalize">
                {profile?.role ?? "staff"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
