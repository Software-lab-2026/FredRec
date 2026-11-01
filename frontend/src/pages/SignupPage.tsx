import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard, { Field } from "../components/AuthCard";
import { useAuth } from "../context/useAuth";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/workspaces";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!USERNAME_PATTERN.test(username)) {
      setError(
        "Username must be 3–20 characters: letters, numbers or underscores.",
      );
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signup({ username, email, password });
      navigate(next, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Pick a unique username — teammates will use it to find you."
      error={error}
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Log in
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
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthCard>
  );
}
