import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import AdminPage from "./pages/AdminPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ExpertPage from "./pages/ExpertPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import SearchPage from "./pages/SearchPage";
import SignupPage from "./pages/SignupPage";
import SuggestPage from "./pages/SuggestPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import TeamsPage from "./pages/TeamsPage";
import TopicsPage from "./pages/TopicsPage";
import WorkspaceDetailPage from "./pages/WorkspaceDetailPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import Loader from "./components/Loader";

//Lazy Loading done only on visit
const ConceptGraphPage = lazy(() => import("./pages/ConceptGraphPage"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public: anyone can search without an account */}
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="topics" element={<TopicsPage />} />
        {/* concept maps: only the domain's experts and the admin */}
        <Route
          path="graph/:domainId"
          element={
            <RequireRole roles={["expert", "admin"]}>
              <Suspense fallback={<Loader />}>
                <ConceptGraphPage />
              </Suspense>
            </RequireRole>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />

        {/*logged-in only */}
        <Route
          path="workspaces"
          element={
            <RequireAuth>
              <WorkspacesPage />
            </RequireAuth>
          }
        />
        <Route
          path="workspaces/:id"
          element={
            <RequireAuth>
              <WorkspaceDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="workspace"
          element={<Navigate to="/workspaces" replace />}
        />
        <Route
          path="teams"
          element={
            <RequireAuth>
              <TeamsPage />
            </RequireAuth>
          }
        />
        <Route
          path="teams/:id"
          element={
            <RequireAuth>
              <TeamDetailPage />
            </RequireAuth>
          }
        />

        <Route
          path="change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="suggest"
          element={
            <RequireAuth>
              <SuggestPage />
            </RequireAuth>
          }
        />
        <Route
          path="suggestions"
          element={
            <RequireAuth>
              <SuggestionsPage />
            </RequireAuth>
          }
        />

        {/* Role-restricted */}
        <Route
          path="expert"
          element={
            <RequireRole roles={["expert"]}>
              <ExpertPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole roles={["admin"]}>
              <AdminPage />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
