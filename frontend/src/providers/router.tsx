import { createBrowserRouter } from "react-router-dom";
import { APP_ROUTES } from "@/config/constants";
import AuthGuard from "./AuthGuard";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import TodayPage from "@/features/tasks/pages/TodayPage";
import UpcomingPage from "@/features/tasks/pages/UpcomingPage";
import AllTasksPage from "@/features/tasks/pages/AllTasksPage";
import ArchivePage from "@/features/tasks/pages/ArchivePage";
import SettingsPage from "@/pages/SettingsPage";

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
