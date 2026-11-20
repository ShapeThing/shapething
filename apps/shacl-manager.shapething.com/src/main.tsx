import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@shapething/shacl-manager/style.css";
import { App } from "./App.tsx";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
