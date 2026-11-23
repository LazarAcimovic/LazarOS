import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { apiGetMe } from "@/features/auth";
import { APP_ROUTES } from "@/config/constants";
import Loader from "@/components/shared/Loader";

export default function AuthGuard() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) return;

    const ac = new AbortController();
    (async () => {
      try {
        const me = await apiGetMe(ac.signal);
        setUser(me);
        setLoading(false);
      } catch (err: unknown) {
        if ((err as { code?: string }).code === "ERR_CANCELED") return;
        setUser(null);
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [isLoading, setUser, setLoading]);

  if (isLoading) return <Loader />;
  if (!user) return <Navigate to={APP_ROUTES.LOGIN} replace />;
  return <Outlet />;
}
