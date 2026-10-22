import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import TopicsPage from "./pages/TopicsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="topics" element={<TopicsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route
          path="workspaces"
          element={
            <RequireAuth>
              <WorkspacesPage />
            </RequireAuth>
          }
        />
        <Route
          path="workspace"
          element={<Navigate to="/workspaces" replace />}
        />
      </Route>
    </Routes>
  );
}
