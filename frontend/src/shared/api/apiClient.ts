import axios from "axios";
import { APP_ROUTES } from "@/config/constants";

const apiClient = axios.create({
  // VITE_API_URL="http://localhost:5000/api" from .env.development (direct — no Vite proxy)
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true, // required: sends the SameSite=None jwt cookie cross-origin
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? "";
    const isAuthCheck = url.includes("/auth/me");
    const isAuthRoute =
      window.location.pathname === APP_ROUTES.LOGIN ||
      window.location.pathname === APP_ROUTES.REGISTER;

    // Only hard-redirect for 401s on protected calls (not the initial auth check)
    if (err.response?.status === 401 && !isAuthCheck && !isAuthRoute) {
      window.location.href = APP_ROUTES.LOGIN;
    }
    return Promise.reject(err);
  }
);

export default apiClient;
