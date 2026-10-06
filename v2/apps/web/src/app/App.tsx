import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";
import { AuthProvider } from "../auth/AuthProvider";
import { RequireAuth } from "../auth/RequireAuth";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { ClientsPage } from "../features/clients/ClientsPage";
import { ImplementationsPage } from "../features/implementations/ImplementationsPage";
import { ImplementationDetailPage } from "../features/implementations/ImplementationDetailPage";
import { WorkItemDetailPage } from "../features/work-items/WorkItemDetailPage";
import { WorkItemsPage } from "../features/work-items/WorkItemsPage";
import { AccountPage } from "../features/account/AccountPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="tickets" element={<WorkItemsPage key="support" type="support" section="tickets" basePath="/tickets" />} />
              <Route path="tickets/:id" element={<WorkItemDetailPage section="tickets" basePath="/tickets" />} />
              <Route path="tareas" element={<WorkItemsPage key="task" type="task" section="tasks" basePath="/tareas" />} />
              <Route path="tareas/:id" element={<WorkItemDetailPage section="tasks" basePath="/tareas" />} />
              <Route path="implementaciones" element={<ImplementationsPage />} />
              <Route path="implementaciones/:id" element={<ImplementationDetailPage />} />
              <Route path="clientes" element={<ClientsPage />} />
              <Route path="reportes" element={<ComingSoonPage section="reports" phase={1} />} />
              <Route path="chat" element={<ComingSoonPage section="chat" phase={2} />} />
              <Route path="configuracion" element={<SettingsPage />} />
              <Route path="cuenta" element={<AccountPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
