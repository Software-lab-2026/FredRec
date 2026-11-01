import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthCard, { Field } from "../components/AuthCard";
import { useAuth } from "../context/useAuth";
import { Spinner } from "../components/Loader";

const HOME_BY_ROLE = { enduser: "/workspaces", expert: "/expert", admin: "/admin" } as const;

export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const forced = user?.mustChangePassword ?? false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don’t match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      navigate(params.get("next") ?? HOME_BY_ROLE[user!.role], { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Change your password"
      subtitle={
        forced
          ? "Your account was created with a temporary password. Change to continue."
          : "Choose a new password for your account."
      }
      error={error}
      footer={<>Passwords must be at least 8 characters.</>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={forced ? "Temporary password" : "Current password"}
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-brand-600 dark:bg-brand-400 py-2 font-medium text-brand-400 dark:text-brand-600 hover:bg-brand-700 dark:hover:bg-brand-300 disabled:opacity-50"
        >
          {submitting ? (
            <Spinner />
          ) : (
            "Save password"
          )}
        </button>
      </form>
    </AuthCard>
  );
}
