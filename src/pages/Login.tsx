import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Store, Eye, EyeOff, LogIn } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      toast.error("Wrong email or password. Please try again.");
    } else {
      toast.success("Welcome back!");
      navigate("/");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#1E293B] rounded-3xl flex items-center justify-center mb-4 shadow-xl">
            <Store size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A]">
            Jonel General Merchandise
           </h1>
          <p className="text-[#64748B] mt-1 text-base">Watch & Merchandise</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-[#0F172A] mb-6">
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[#0F172A]">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 text-base focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[#0F172A]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 text-base focus:outline-none focus:border-blue-500 transition-colors pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] transition-colors"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl text-base transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[#64748B] text-sm mt-6">
          Contact the owner if you forgot your password
        </p>
      </div>
    </div>
  );
}

// Change Password
// sqlupdate auth.users
// set encrypted_password = crypt('newpassword123', gen_salt('bf'))
// where email = 'mom@gmail.com';

// -- Update in auth
// update auth.users
// set email = 'newemail@gmail.com'
// where email = 'mom@gmail.com';

// -- Update in profiles too
// update profiles
// set email = 'newemail@gmail.com'
// where email = 'mom@gmail.com';

// -- Step 1: Create auth user
// insert into auth.users (
//   instance_id, id, aud, role, email,
//   encrypted_password, email_confirmed_at,
//   created_at, updated_at,
//   raw_app_meta_data, raw_user_meta_data,
//   is_super_admin, confirmation_token,
//   recovery_token, email_change_token_new, email_change
// )
// values (
//   '00000000-0000-0000-0000-000000000000',
//   gen_random_uuid(),
//   'authenticated', 'authenticated',
//   'staff@gmail.com',
//   crypt('staff12345', gen_salt('bf')),
//   now(), now(), now(),
//   '{"provider":"email","providers":["email"]}',
//   '{"full_name":"Staff Name"}',
//   false, '', '', '', ''
// );

// -- Step 2: Update their profile (trigger auto-creates it)
// update profiles
// set role = 'staff', full_name = 'Staff Name'
// where email = 'staff@gmail.com';

// select p.full_name, p.email, p.role
// from profiles p
// join auth.users u on p.id = u.id;

// delete from profiles where email = 'staff@gmail.com';
// delete from auth.users where email = 'staff@gmail.com';
