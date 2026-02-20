import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Global error handler for cross-origin script errors (like TradingView)
window.addEventListener("error", (event) => {
  // Suppress generic "Script error" from cross-origin scripts
  if (
    event.message === "Script error." ||
    event.message.includes("Script error")
  ) {
    console.warn("Suppressed cross-origin script error:", event);
    event.preventDefault();
    return true;
  }
});

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.warn("Unhandled promise rejection:", event.reason);
  event.preventDefault();
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
