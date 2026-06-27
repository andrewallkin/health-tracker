import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import App from "./App";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RequireGoalsConfigured } from "./components/layout/RequireGoalsConfigured";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingGoalsPage } from "./pages/OnboardingGoalsPage";
import { RegisterPage } from "./pages/RegisterPage";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/onboarding/goals", element: <OnboardingGoalsPage /> },
      {
        element: <RequireGoalsConfigured />,
        children: [{ path: "/*", element: <App /> }],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
