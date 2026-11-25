import { Aside } from "./Aside.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { KeepAliveOutlet } from "./KeepAliveOutlet.tsx";
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
        <KeepAliveOutlet />
      </main>
      <Aside />
    </div>
  );
}
