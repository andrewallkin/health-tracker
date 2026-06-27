import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppRouter } from "./AppRouter";
import { AuthProvider } from "./context/AuthProvider";
import { ConfirmDialogProvider } from "./context/ConfirmDialogProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmDialogProvider>
        <AppRouter />
      </ConfirmDialogProvider>
    </AuthProvider>
  </StrictMode>,
);
