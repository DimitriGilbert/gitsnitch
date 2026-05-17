import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import { App } from "./app.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Renderer root element #root was not found in the report template.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
