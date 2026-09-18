import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import "./style.css";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="st-manager-layout">
      <Sidebar />
      <div className="st-manager-layout__content">{children}</div>
    </div>
  );
}
