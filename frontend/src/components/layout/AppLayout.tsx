import { Outlet } from "react-router-dom";
import NavBar from "../navigation/NavBar";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <NavBar />
      <main className="app-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
