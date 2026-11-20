import type { ReactNode } from "react";
import { Navigate, Outlet, useOutlet } from "react-router";
import "./listDetail.css";

// The list on the left acts as vertical tabs; the selected item's route renders on the right.
export function ListDetail({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="st-list-detail">
      <header className="st-list-detail__header">
        <h3 className="st-list-detail__title">{title}</h3>
        {actions}
      </header>
      <nav className="st-list-detail__tabs" aria-label={title}>
        {children}
      </nav>
      <div className="st-list-detail__content">
        <Outlet />
      </div>
    </div>
  );
}

// Selects the first item (`to` is its segment) when none is, so the detail column is never empty.
export function SelectFirst({ to }: { to: string | undefined }) {
  const outlet = useOutlet();
  return !outlet && to ? <Navigate to={`./${to}`} replace /> : null;
}
