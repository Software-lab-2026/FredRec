import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard, { Field } from "../components/AuthCard";
import { useAuth } from "../context/useAuth";
import { Spinner } from "../components/Loader";


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/workspaces";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      split
      title="Log in"
      subtitle="Log in to save resources and track your progress."
      error={error}
      footer={
        <>
          New here?{" "}
          <Link
            to={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          autoComplete="username"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 dark:bg-brand-400 py-2 font-medium text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300 disabled:opacity-50"
        >
          {submitting ? (
            <Spinner />
          ) : (
            "Log in"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
