import { Outlet } from "react-router-dom";
import NavBar from "../navigation/NavBar";

// UI §10: one breakpoint (md = 768px). Below it the sidebar collapses into a top bar
// (NavBar's own classes are overridden from here with max-md child selectors).
export default function AppLayout() {
  return (
    <div
      className={[
        "flex min-h-screen bg-background text-foreground",
        "max-md:flex-col",
        "max-md:[&>nav]:static max-md:[&>nav]:h-auto max-md:[&>nav]:w-full",
        "max-md:[&>nav]:border-r-0 max-md:[&>nav]:border-b max-md:[&>nav]:py-3",
        "max-md:[&>nav>ul]:flex-row max-md:[&>nav>ul]:overflow-x-auto max-md:[&>nav>ul]:px-3",
        "max-md:[&>nav_a]:whitespace-nowrap",
      ].join(" ")}
    >
      <NavBar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
