import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { DateRangeProvider } from "./context/DateRangeContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DateRangeProvider>
          <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 2200,
            style: {
              border: "1px solid var(--color-line)",
              borderRadius: "12px",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              fontSize: "13px",
            },
          }}
        />
        </DateRangeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
