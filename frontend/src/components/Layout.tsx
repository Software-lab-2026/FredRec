import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import ThemeToggle from "./ThemeToggle";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="mr-4 text-lg font-bold text-indigo-600 dark:text-indigo-400"
          >
            FredRec
          </Link>
          <NavLink to="/topics">Topics</NavLink>
          {user && (
            <NavLink to="/workspaces" className={navClass}>
              My Workspaces
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  @{user.username}
                </span>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="rounded-md px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Free educational resources for Computer Science
      </footer>
    </div>
  );
}
