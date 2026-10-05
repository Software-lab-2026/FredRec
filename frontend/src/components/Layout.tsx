import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

export default function Layout() {
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
