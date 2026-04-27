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
    // Main background changed to the Cream color from the image
    <div className="flex h-screen bg-[#FDFBF9] overflow-hidden">
      
      {/* Sidebar - Changed to Dark Charcoal (#33302E) */}
      <aside className="w-72 bg-[#33302E] flex flex-col shrink-0 shadow-xl">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4 px-6 py-8 border-b border-white/5">
          {/* Icon background changed to the vibrant Orange */}
          <div className="w-12 h-12 bg-[#FF8C42] rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-900/20">
            <Store size={26} className="text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-bold text-lg leading-tight whitespace-nowrap">
              Jonel General
            </p>
            <p className="text-white/50 text-sm">Merchandise</p>
          </div>
        </div>

        {/* Navigation - Increased text size and spacing for readability */}
        <nav className="flex-1 px-4 py-8 flex flex-col gap-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-4 px-5 py-4 rounded-2xl text-lg font-medium transition-all duration-200
                ${
                  isActive
                    ? "bg-[#FF8C42] text-white shadow-lg shadow-orange-900/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={24} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Profile + Sign Out Section */}
        <div className="px-4 py-6 border-t border-white/5">
          {/* User Info Card */}
          <div className="flex items-center gap-3 px-4 py-4 mb-4 bg-white/5 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-[#FF8C42]/20 flex items-center justify-center shrink-0 border border-[#FF8C42]/30">
              <span className="text-[#FF8C42] font-bold text-lg">
                {profile?.full_name?.charAt(0).toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-base font-semibold truncate">
                {profile?.full_name ?? "User"}
              </p>
              <p className="text-white/40 text-xs capitalize">
                {profile?.role ?? "staff"}
              </p>
            </div>
          </div>

          {/* Sign Out Button - Made more distinct but elegant */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all text-base font-medium"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* The Outlet will render the Dashboard (which we already styled) */}
        <Outlet />
      </main>
    </div>
  );
}