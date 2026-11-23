import { NavLink } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";
import { cn } from "@/lib/utils";

const links = [
  { to: APP_ROUTES.TODAY, label: "Today", end: true },
  { to: APP_ROUTES.UPCOMING, label: "Upcoming" },
  { to: APP_ROUTES.ALL_TASKS, label: "All Tasks" },
  { to: APP_ROUTES.ARCHIVE, label: "Archive" },
  { to: APP_ROUTES.SETTINGS, label: "Settings" },
];

export default function NavBar() {
  return (
    <nav className="sticky top-0 flex h-screen w-55 shrink-0 flex-col border-r border-border bg-card py-6">
      <span className="px-5 pb-6 text-lg font-bold tracking-tight text-primary">
        LazarOS
      </span>
      <ul className="flex flex-col gap-0.5 px-2.5">
        {links.map(({ to, label, end }) => (
          <li key={to} className="block">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "block rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
