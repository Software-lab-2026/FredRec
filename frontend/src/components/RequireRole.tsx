import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { Role } from "../types/resource";
import RequireAuth from "./RequireAuth";

/* Like RequireAuth, but allso limits the page to given roles */
export default function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleGate roles={roles}>{children}</RoleGate>
    </RequireAuth>
  );
}

function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (user && roles.includes(user.role)) return children;
  return (
    <div className="pt-16 text-center">
      <h1 className="text-2xl font-bold">You don’t have access to this page</h1>
      <Link to="/" className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:underline">
        Back to search
      </Link>
    </div>
  );
}
