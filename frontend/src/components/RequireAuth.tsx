import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import Loader from "./Loader";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const here = encodeURIComponent(location.pathname + location.search);
  if (loading) return <Loader className="p-8"/>;
  if (!user)
    return <Navigate to={`/login?next=${here}`}replace/>;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to={`/change-password?next=${here}`} replace />;
  }
    
  return children;
}
