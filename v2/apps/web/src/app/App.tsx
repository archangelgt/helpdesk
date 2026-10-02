import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { AuthProvider } from "../auth/AuthProvider";
import { RequireAuth } from "../auth/RequireAuth";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { ImplementationsPage } from "../features/implementations/ImplementationsPage";
import { ImplementationDetailPage } from "../features/implementations/ImplementationDetailPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="implementaciones" element={<ImplementationsPage />} />
              <Route path="implementaciones/:id" element={<ImplementationDetailPage />} />
              <Route path="tickets" element={<ComingSoonPage section="tickets" phase={1} />} />
              <Route path="tareas" element={<ComingSoonPage section="tasks" phase={1} />} />
              <Route path="clientes" element={<ComingSoonPage section="clients" phase={1} />} />
              <Route path="reportes" element={<ComingSoonPage section="reports" phase={1} />} />
              <Route path="chat" element={<ComingSoonPage section="chat" phase={2} />} />
              <Route path="configuracion" element={<ComingSoonPage section="settings" phase={1} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
