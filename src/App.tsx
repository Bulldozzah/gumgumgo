import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { Toaster } from "sonner";
import { supabase } from "@/lib/supabase";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import ShopperDashboard from "@/features/shopper/ShopperDashboard";
import StoreOwnerDashboard from "@/features/store/StoreOwnerDashboard";
import AdminDashboard from "@/features/admin/AdminDashboard";
import NotFound from "@/pages/NotFound";

const AppContent = () => {
  const [, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const roleLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        roleLoadedRef.current = false;
        setSession(null);
        setUser(null);
        setUserRole(null);
        setLoading(false);
        return;
      }

      // Only update state for valid sessions — avoids clearing user state
      // during token refresh or transient events.
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        if (!roleLoadedRef.current) {
          roleLoadedRef.current = true;
          // setTimeout avoids the Supabase auth-callback deadlock.
          setTimeout(() => {
            if (isMounted) loadUserRole(session.user.id);
          }, 0);
        } else {
          setLoading(false);
        }
      } else if (event === "INITIAL_SESSION") {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        if (!roleLoadedRef.current) {
          roleLoadedRef.current = true;
          loadUserRole(session.user.id);
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setUserRole(data?.role || "shopper");
    } catch {
      setUserRole("shopper");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-ink-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
          <span className="text-sm font-medium">Loading gumgumgo…</span>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isShopper = userRole === "shopper" || !userRole;

  return (
    <Routes>
      <Route
        path="/"
        element={
          !user ? (
            <Landing />
          ) : isAdmin ? (
            <Navigate to="/admin" replace />
          ) : userRole === "store_owner" ? (
            <Navigate to="/store" replace />
          ) : (
            <Navigate to="/shop" replace />
          )
        }
      />
      <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" replace />} />
      <Route
        path="/admin"
        element={user && isAdmin ? <AdminDashboard /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/store"
        element={user && userRole === "store_owner" ? <StoreOwnerDashboard /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/shop"
        element={user && isShopper ? <ShopperDashboard /> : <Navigate to="/auth" replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <Toaster position="top-right" richColors />
    <AppContent />
  </BrowserRouter>
);

export default App;
