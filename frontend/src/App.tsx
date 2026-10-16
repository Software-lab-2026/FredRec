import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import TopicsPage from "./pages/TopicsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="topics" element={<TopicsPage />} />
      </Route>
    </Routes>
  );
}
