import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { apiLogout } from "@/features/auth";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-5 gap-4 rounded-md p-6">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[15px]">{children}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    navigate(APP_ROUTES.LOGIN);
  };

  const isDark = theme === "dark";

  return (
    <div className="mx-auto max-w-215 px-8 py-9 max-md:px-4 max-md:py-5">
      <div className="mb-7 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <section>
        <Section title="Profile">
          <Field label="Name">
            {user?.first_name} {user?.last_name}
          </Field>
          <Field label="Email">{user?.email}</Field>
        </Section>
      </section>

      <section>
        <Section title="Appearance">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted-foreground">
              Dark Mode
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              role="switch"
              aria-checked={isDark}
              className={cn(
                "relative h-6.5 w-12 rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                isDark ? "bg-primary" : "bg-border"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.75 left-0.75 size-5 rounded-full bg-white shadow-sm transition-transform",
                  isDark && "translate-x-5.5"
                )}
              />
            </button>
          </div>
        </Section>
      </section>

      <section>
        <Section title="Account">
          <div>
            <Button variant="destructive" onClick={handleLogout}>
              Log Out
            </Button>
          </div>
        </Section>
      </section>
    </div>
  );
}
