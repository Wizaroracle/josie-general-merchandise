import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Store, Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your email and password.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast.error("Wrong email or password. Please try again.");
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate("/");
    setIsLoading(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F6F0EA] p-4 text-[#1F1712] sm:p-6">
      {/* Soft background accents */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#FF6B0A]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-[#8B572A]/10 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-[#E6D2BD] bg-[#FFF8F1] shadow-2xl lg:grid-cols-[1fr_1.05fr]">
        {/* Left Branding Panel */}
        <section className="hidden bg-[#3B312A] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FF6B0A] shadow-lg shadow-[#FF6B0A]/20">
              <Store size={34} />
            </div>

            <h1 className="max-w-sm text-4xl font-extrabold leading-tight">
              Jonel General Merchandise
            </h1>

            <p className="mt-3 text-lg font-semibold text-white/55">
              Watch & Merchandise
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#FF8A2A]">
              <ShieldCheck size={25} />
            </div>

            <p className="text-xl font-extrabold">Secure Store Access</p>
            <p className="mt-2 text-base font-medium leading-relaxed text-white/55">
              Sign in to manage inventory, record sales, and view reports.
            </p>
          </div>
        </section>

        {/* Login Form Panel */}
        <section className="p-6 sm:p-8 lg:p-10">
          {/* Mobile Logo */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#FF6B0A] text-white shadow-lg shadow-[#FF6B0A]/20">
              <Store size={38} />
            </div>

            <h1 className="text-3xl font-extrabold leading-tight text-[#1F1712]">
              Jonel General Merchandise
            </h1>

            <p className="mt-1 text-base font-semibold text-[#7C6D64]">
              Watch & Merchandise
            </p>
          </div>

          <div className="mx-auto max-w-md">
            <div className="mb-7">
              <p className="mb-2 inline-flex rounded-full bg-[#FFF0DE] px-4 py-2 text-sm font-extrabold text-[#FF6B0A]">
                Welcome back
              </p>

              <h2 className="text-3xl font-extrabold tracking-tight text-[#1F1712] sm:text-4xl">
                Sign in
              </h2>

              <p className="mt-2 text-base font-semibold text-[#6F625A]">
                Enter your account details to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-base font-extrabold text-[#1F1712]"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={isLoading}
                  className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-base font-extrabold text-[#1F1712]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="min-h-14 w-full rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] px-4 py-3.5 pr-14 text-base font-semibold text-[#1F1712] outline-none transition placeholder:text-[#A8988D] focus:border-[#FF6B0A] focus:ring-4 focus:ring-[#FF6B0A]/15 disabled:cursor-not-allowed disabled:opacity-70"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isLoading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#7C6D64] transition hover:bg-[#FFF0DE] hover:text-[#FF6B0A] focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#FF6B0A] px-5 py-4 text-lg font-extrabold text-white shadow-lg shadow-[#FF6B0A]/20 transition-all hover:bg-[#E85F08] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#D8C8B8] disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-[#FF6B0A]/25"
              >
                {isLoading ? (
                  <>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={23} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-[#E6D2BD] bg-[#FFFDF9] p-4 text-center">
              <p className="text-sm font-semibold text-[#7C6D64]">
                Forgot your password?
              </p>
              <p className="mt-1 text-base font-extrabold text-[#1F1712]">
                Contact the owner for assistance.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
