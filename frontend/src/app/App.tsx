import { RouterProvider } from "react-router-dom";
import { router } from "@/providers/router";
import { useThemeStore } from "@/store/themeStore";
import { useEffect } from "react";

export default function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <RouterProvider router={router} />;
}
