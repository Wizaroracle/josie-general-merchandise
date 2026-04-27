import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  BarChart3,
  LogOut,
  Store,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
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

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");

    if (saved === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/login");
  };

  const userInitial =
    profile?.full_name?.charAt(0).toUpperCase() ??
    profile?.email?.charAt(0).toUpperCase() ??
    "U";

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F6F0EA] text-[#1F1712]">
      {/* Mobile / Small Tablet Top Bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[#E6D2BD] bg-[#FFF8F1] px-4 shadow-sm md:hidden">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B0A] text-white shadow-sm transition hover:bg-[#E85F08] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
        >
          <Menu size={26} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6B0A] text-white">
            <Store size={21} />
          </div>

          <div className="leading-tight">
            <p className="text-sm font-extrabold text-[#1F1712]">
              Jonel General
            </p>
            <p className="text-xs font-semibold text-[#7C6D64]">Merchandise</p>
          </div>
        </div>

        <div className="h-12 w-12" />
      </header>

      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/45 md:hidden"
        />
      )}

      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-[#51443C] bg-[#3B312A] transition-all duration-300 md:flex md:flex-col ${
          sidebarCollapsed ? "md:w-[88px]" : "md:w-[292px]"
        }`}
      >
        {/* Logo / Header */}
        <div
          className={`flex min-h-[104px] items-center border-b border-white/10 px-4 ${
            sidebarCollapsed ? "justify-center" : "justify-between gap-3"
          }`}
        >
          <div
            className={`flex min-w-0 items-center ${
              sidebarCollapsed ? "justify-center" : "gap-4"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B0A] text-white shadow-sm">
              <Store size={24} />
            </div>

            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight text-white">
                  Jonel General
                </p>
                <p className="text-base font-bold leading-tight text-white">
                  Merchandise
                </p>
                <p className="mt-1 text-sm font-semibold text-white/45">
                  Watch & Merchandise
                </p>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Collapse sidebar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
            >
              <ChevronLeft size={23} />
            </button>
          )}
        </div>

        {/* Collapse Button for Icon Mode */}
        {sidebarCollapsed && (
          <div className="border-b border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label="Expand sidebar"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav
          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-5 ${
            sidebarCollapsed ? "px-3" : "px-4"
          }`}
        >
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `group relative flex min-h-[56px] items-center rounded-2xl text-base font-extrabold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25 ${
                  sidebarCollapsed ? "justify-center px-0" : "gap-4 px-4 py-3.5"
                } ${
                  isActive
                    ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/25"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={23} className="shrink-0" />

              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Sign Out */}
        <div
          className={`shrink-0 border-t border-white/10 py-4 ${
            sidebarCollapsed ? "px-3" : "px-4"
          }`}
        >
          <div
            className={`mb-2 flex items-center rounded-2xl ${
              sidebarCollapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-3"
            }`}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#8B572A]">
              <span className="text-lg font-extrabold text-[#FF8A2A]">
                {userInitial}
              </span>
            </div>

            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-white">
                  {profile?.full_name ?? "User"}
                </p>
                <p className="truncate text-sm font-semibold capitalize text-white/45">
                  {profile?.role ?? "staff"}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className={`flex min-h-[52px] w-full items-center rounded-2xl text-base font-extrabold text-white/55 transition-all hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-4 focus:ring-red-500/20 ${
              sidebarCollapsed ? "justify-center px-0" : "gap-3 px-4 py-3"
            }`}
          >
            <LogOut size={21} className="shrink-0" />

            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[292px] shrink-0 flex-col overflow-hidden border-r border-[#51443C] bg-[#3B312A] shadow-2xl transition-transform duration-300 md:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile Logo */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B0A] text-white shadow-sm">
              <Store size={24} />
            </div>

            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight text-white">
                Jonel General
              </p>
              <p className="text-base font-bold leading-tight text-white">
                Merchandise
              </p>
              <p className="mt-1 text-sm font-semibold text-white/45">
                Watch & Merchandise
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[56px] items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-extrabold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25 ${
                  isActive
                    ? "bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/25"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={23} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Mobile User + Sign Out */}
        <div className="shrink-0 border-t border-white/10 px-4 py-5">
          <div className="mb-3 flex items-center gap-3 rounded-2xl px-3 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#8B572A]">
              <span className="text-lg font-extrabold text-[#FF8A2A]">
                {userInitial}
              </span>
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-white">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-sm font-semibold capitalize text-white/45">
                {profile?.role ?? "staff"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-base font-extrabold text-white/55 transition-all hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-4 focus:ring-red-500/20"
          >
            <LogOut size={21} className="shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content - NO PAGE SCROLL */}
      <main className="min-w-0 flex-1 overflow-hidden bg-[#F6F0EA] pt-16 md:pt-0">
        <div className="h-full min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
