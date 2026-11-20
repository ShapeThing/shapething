import { Outlet } from "react-router";
import { Aside } from "./Aside.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { SaveButton } from "./SaveButton.tsx";
import { Sidebar } from "./Sidebar.tsx";
import "./layout.css";

export function Layout() {
  return (
    <div className="st-manager">
      <Sidebar />
      <main className="st-manager__main">
        <div className="st-manager__toolbar">
          <Breadcrumb />
          <SaveButton />
        </div>
        <Outlet />
      </main>
      <Aside />
    </div>
  );
}
