import { NavLink } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";

const links = [
  { to: APP_ROUTES.TODAY, label: "Today", end: true },
  { to: APP_ROUTES.UPCOMING, label: "Upcoming" },
  { to: APP_ROUTES.ALL_TASKS, label: "All Tasks" },
  { to: APP_ROUTES.ARCHIVE, label: "Archive" },
  { to: APP_ROUTES.SETTINGS, label: "Settings" },
];

export default function NavBar() {
  return (
    <nav className="navbar">
      <span className="navbar__brand">LazarOS</span>
      <ul className="navbar__links">
        {links.map(({ to, label, end }) => (
          <li key={to} className="navbar__item">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `navbar__link${isActive ? " navbar__link--active" : ""}`
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
