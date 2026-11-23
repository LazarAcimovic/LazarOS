import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { apiRegister } from "../api";
import { registerSchema, type RegisterFormValues } from "../models";
import { useAuthStore } from "@/store/authStore";
import { APP_ROUTES } from "@/config/constants";
import { getApiError } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-xs text-destructive">{message}</span>;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
  });
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onValid = async (values: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const { confirm_password: _, ...payload } = values;
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
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-105 rounded-lg border border-border bg-card p-10 shadow-lg">
        <h1 className="mb-1 text-3xl font-extrabold text-primary">LazarOS</h1>
        <p className="mb-7 text-sm text-muted-foreground">Create your account</p>

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

          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-35 flex-1 flex-col gap-1.5">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                aria-invalid={errors.first_name ? true : undefined}
                {...register("first_name")}
              />
              <FieldError message={errors.first_name?.message} />
            </div>

            <div className="flex min-w-35 flex-1 flex-col gap-1.5">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                aria-invalid={errors.last_name ? true : undefined}
                {...register("last_name")}
              />
              <FieldError message={errors.last_name?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <FieldError message={errors.password?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-10"
                aria-invalid={errors.confirm_password ? true : undefined}
                {...register("confirm_password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <FieldError message={errors.confirm_password?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <Link to={APP_ROUTES.LOGIN} className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
