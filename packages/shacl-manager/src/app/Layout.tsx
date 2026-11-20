import { Outlet } from "react-router";
import { Aside } from "./Aside.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { Sidebar } from "./Sidebar.tsx";
import "./layout.css";

export function Layout() {
  return (
    <div className="st-manager">
      <Sidebar />
      <main className="st-manager__main">
        <Breadcrumb />
        <Outlet />
      </main>
      <Aside />
    </div>
  );
}
