import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRegister } from "../api";
import { registerSchema } from "../validation";
import { useAuthStore } from "@/store/authStore";
import { APP_ROUTES } from "@/config/constants";
import { getApiError } from "@/shared/utils";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = String(err.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { confirm_password: _, ...payload } = result.data;
      const user = await apiRegister(payload);
      setUser(user);
      setLoading(false);
      navigate(APP_ROUTES.TODAY);
    } catch (err: unknown) {
      setServerError(getApiError(err, "Registration failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__title">LazarOS</h1>
        <p className="auth__subtitle">Create your account</p>

        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          {serverError && <div className="auth__error">{serverError}</div>}

          <div className="form-row">
            <div className="form-group">
              <label className="form-group__label" htmlFor="first_name">
                First Name
              </label>
              <input
                id="first_name"
                className={`form-group__input${errors.first_name ? " form-group__input--error" : ""}`}
                type="text"
                value={form.first_name}
                onChange={set("first_name")}
              />
              {errors.first_name && (
                <span className="form-group__error">{errors.first_name}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-group__label" htmlFor="last_name">
                Last Name
              </label>
              <input
                id="last_name"
                className={`form-group__input${errors.last_name ? " form-group__input--error" : ""}`}
                type="text"
                value={form.last_name}
                onChange={set("last_name")}
              />
              {errors.last_name && (
                <span className="form-group__error">{errors.last_name}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-group__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={`form-group__input${errors.email ? " form-group__input--error" : ""}`}
              type="email"
              value={form.email}
              onChange={set("email")}
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
            <div className="form-group__input-wrap">
              <input
                id="password"
                className={`form-group__input${errors.password ? " form-group__input--error" : ""}`}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="form-group__eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <span className="form-group__error">{errors.password}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-group__label" htmlFor="confirm_password">
              Confirm Password
            </label>
            <div className="form-group__input-wrap">
              <input
                id="confirm_password"
                className={`form-group__input${errors.confirm_password ? " form-group__input--error" : ""}`}
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirm_password}
                onChange={set("confirm_password")}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="form-group__eye"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.confirm_password && (
              <span className="form-group__error">{errors.confirm_password}</span>
            )}
          </div>

          <button
            className="btn btn--primary btn--full"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth__switch">
          Already have an account?{" "}
          <Link to={APP_ROUTES.LOGIN}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
