import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiLogin } from "../api";
import { loginSchema } from "../validation";
import { useAuthStore } from "@/store/authStore";
import { APP_ROUTES } from "@/config/constants";
import { getApiError } from "@/shared/utils";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = String(err.path[0]);
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const user = await apiLogin(result.data);
      setUser(user);
      setLoading(false);
      navigate(APP_ROUTES.TODAY);
    } catch (err: unknown) {
      setServerError(getApiError(err, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__title">LazarOS</h1>
        <p className="auth__subtitle">Sign in to your workspace</p>

        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          {serverError && <div className="auth__error">{serverError}</div>}

          <div className="form-group">
            <label className="form-group__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={`form-group__input${errors.email ? " form-group__input--error" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && (
              <span className="form-group__error">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-group__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={`form-group__input${errors.password ? " form-group__input--error" : ""}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {errors.password && (
              <span className="form-group__error">{errors.password}</span>
            )}
          </div>

          <button
            className="btn btn--primary btn--full"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth__switch">
          Don&apos;t have an account?{" "}
          <Link to={APP_ROUTES.REGISTER}>Register</Link>
        </p>
      </div>
    </div>
  );
}
