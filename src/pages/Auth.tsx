import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Logo, Spinner } from "@/components/ui";

const AuthPage = () => {
  const [params] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(params.get("join") === "1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Account created! Check your email to verify.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        navigate("/");
      }
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-[#013912] p-10 lg:flex">
        <Logo className="text-2xl !text-white" />
        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight text-white">
            Your list. Every store. <span className="text-brand">One best price.</span>
          </h1>
          <ul className="mt-6 space-y-3 text-white/80">
            <li>✓ Compare full-basket totals across stores</li>
            <li>✓ AI suggestions when you're over budget</li>
            <li>✓ Community-verified price updates</li>
          </ul>
        </div>
        <p className="text-sm text-white/50">© {new Date().getFullYear()} gumgumgo</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-darker"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="lg:hidden">
            <Logo className="text-2xl" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">
            {isSignUp ? "Create a new account" : "Sign in to your account"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {isSignUp
              ? "Start comparing prices and saving in minutes."
              : "Welcome back — your lists are waiting."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field h-11"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={isSignUp ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field h-11 pr-11"
                  placeholder={isSignUp ? "At least 6 characters" : "••••••••"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading && <Spinner />}
              {loading
                ? isSignUp
                  ? "Creating account…"
                  : "Signing in…"
                : isSignUp
                  ? "Join gumgumgo"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            {isSignUp ? "Already have an account?" : "New to gumgumgo?"}{" "}
            <button
              onClick={() => setIsSignUp((s) => !s)}
              className="font-semibold text-brand-darker hover:underline"
            >
              {isSignUp ? "Sign in" : "Join now"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
