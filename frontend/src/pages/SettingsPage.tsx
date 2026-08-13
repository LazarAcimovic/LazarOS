import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { apiLogout } from "@/features/auth/api";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    navigate(APP_ROUTES.LOGIN);
  };

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Settings</h1>
      </div>

      <section className="settings-section">
        <h2 className="settings-section__title">Profile</h2>
        <div className="settings-field">
          <span className="settings-field__label">Name</span>
          <span className="settings-field__value">
            {user?.first_name} {user?.last_name}
          </span>
        </div>
        <div className="settings-field">
          <span className="settings-field__label">Email</span>
          <span className="settings-field__value">{user?.email}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Appearance</h2>
        <div className="settings-field settings-field--row">
          <span className="settings-field__label">Dark Mode</span>
          <button
            className={`toggle${theme === "dark" ? " toggle--on" : ""}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
          >
            <span className="toggle__thumb" />
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Account</h2>
        <button className="btn btn--danger" onClick={handleLogout}>
          Log Out
        </button>
      </section>
    </div>
  );
}
