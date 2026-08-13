import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRegister } from "../api";
import { registerSchema } from "../validation";
import { useAuthStore } from "@/store/authStore";
import { APP_ROUTES } from "@/config/constants";
import { getApiError } from "@/shared/utils";

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
            <input
              id="password"
              className={`form-group__input${errors.password ? " form-group__input--error" : ""}`}
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
            />
            {errors.password && (
              <span className="form-group__error">{errors.password}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-group__label" htmlFor="confirm_password">
              Confirm Password
            </label>
            <input
              id="confirm_password"
              className={`form-group__input${errors.confirm_password ? " form-group__input--error" : ""}`}
              type="password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              autoComplete="new-password"
            />
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
