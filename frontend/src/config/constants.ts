export const APP_ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  TODAY: "/",
  UPCOMING: "/upcoming",
  ALL_TASKS: "/tasks",
  ARCHIVE: "/archive",
  SETTINGS: "/settings",
} as const;

export const API_ROUTES = {
  AUTH: {
    REGISTER: "/api/auth/register",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  TASKS: {
    BASE: "/api/tasks",
    DASHBOARD: "/api/tasks/dashboard",
    UPCOMING: "/api/tasks/upcoming",
    ARCHIVE: "/api/tasks/archive",
    BY_ID: (id: string) => `/api/tasks/${id}`,
    RESTORE: (id: string) => `/api/tasks/${id}/restore`,
  },
} as const;
