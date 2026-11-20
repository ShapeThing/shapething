import type { ReactNode } from "react";
import { Outlet } from "react-router";
import "./listDetail.css";

// Two columns: the list of links on the left acts as vertical tabs, the selected item's route
// renders on the right.
export function ListDetail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="st-list-detail">
      <h3 className="st-list-detail__title">{title}</h3>
      <nav className="st-list-detail__tabs" aria-label={title}>
        {children}
      </nav>
      <div className="st-list-detail__content">
        <Outlet />
      </div>
    </div>
  );
}
