import { startTransition } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { ROLE_LABELS } from "../types/resource";
import ThemeToggle from "./ThemeToggle";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300" : "text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="mr-4 text-lg font-bold text-brand-600 dark:text-brand-400"
          >
            FredRec
          </Link>
          <NavLink to="/topics" className={navClass}>
            Topics
          </NavLink>
          {user && (
            <NavLink to="/workspaces" className={navClass}>
              My Workspaces
            </NavLink>
          )}
          {user && (
            <NavLink to="/teams" className={navClass}>
              Teams
            </NavLink>
          )}
          {user && (
            <NavLink to="/suggestions" className={navClass}>
              My Suggestions
            </NavLink>
          )}
          {user?.role === "expert" && (
            <NavLink to="/expert" className={navClass}>
              Expert
            </NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-sm text-ink-600 dark:text-ink-400">
                  @{user.username}
                  {user.role !== "enduser" && (
                    <span className="ml-1.5 rounded-full bg-ink-100 px-2 py-0.5 text-xs dark:bg-ink-800">
                      {ROLE_LABELS[user.role]}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    navigate("/");
                    startTransition(() => logout());
                  }}
                  className="rounded-md px-3 py-2 text-sm text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <Link
                  to="/signup"
                  className="rounded-md bg-brand-600 dark:bg-brand-400 px-3 py-2 text-sm font-medium text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-ink-200 dark:border-ink-800 py-4 text-center text-xs text-ink-500">
        Free educational resources for Computer Science
      </footer>
    </div>
  );
}
