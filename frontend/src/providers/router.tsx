import { createBrowserRouter } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";
import AuthGuard from "./AuthGuard";
import AppLayout from "@/components/layout/AppLayout";
import { LoginPage, RegisterPage } from "@/features/auth";
import { TodayPage, UpcomingPage, AllTasksPage, ArchivePage } from "@/features/tasks";
import { SettingsPage } from "@/features/settings";

export const router = createBrowserRouter([
  {
    path: APP_ROUTES.LOGIN,
    element: <LoginPage />,
  },
  {
    path: APP_ROUTES.REGISTER,
    element: <RegisterPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: APP_ROUTES.TODAY, element: <TodayPage /> },
          { path: APP_ROUTES.UPCOMING, element: <UpcomingPage /> },
          { path: APP_ROUTES.ALL_TASKS, element: <AllTasksPage /> },
          { path: APP_ROUTES.ARCHIVE, element: <ArchivePage /> },
          { path: APP_ROUTES.SETTINGS, element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
