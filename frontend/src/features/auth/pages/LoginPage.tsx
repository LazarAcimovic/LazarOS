import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiLogin } from "../api";
import { loginSchema, type LoginFormValues } from "../models";
import { useAuthStore } from "@/store/authStore";
import { APP_ROUTES } from "@/config/constants";
import { getApiError } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onValid = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const user = await apiLogin(values);
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
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-105 rounded-lg border border-border bg-card p-10 shadow-lg">
        <h1 className="mb-1 text-3xl font-extrabold text-primary">LazarOS</h1>
        <p className="mb-7 text-sm text-muted-foreground">
          Sign in to your workspace
        </p>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            setServerError("");
            return handleSubmit(onValid)(e);
          }}
          noValidate
        >
          {serverError && (
            <div data-auth-error className="rounded-sm border border-overdue-border bg-overdue-bg px-3.5 py-2.5 text-sm text-overdue-text">
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
            {errors.email && (
              <span className="text-xs text-destructive">
                {errors.email.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...register("password")}
            />
            {errors.password && (
              <span className="text-xs text-destructive">
                {errors.password.message}
              </span>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to={APP_ROUTES.REGISTER} className="font-medium text-primary">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
