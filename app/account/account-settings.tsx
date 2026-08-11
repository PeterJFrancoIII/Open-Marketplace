"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

function normalizeAuthError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (/password|credential|invalid|incorrect|current/i.test(message)) {
      return message.length <= 160 ? message : fallback;
    }
  }
  if (error instanceof Error && error.message) {
    if (/network|fetch/i.test(error.message)) {
      return "Something went wrong. Try again.";
    }
  }
  return fallback;
}

export default function AccountSettings({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState<"name" | "password" | "signout" | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function onUpdateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setStatus("");
      setError("Enter a display name.");
      return;
    }
    setPending("name");
    setStatus("");
    setError("");
    try {
      const result = await authClient.updateUser({ name: normalizedName });
      if (result.error) {
        setError(normalizeAuthError(result.error, "Could not update your name."));
        return;
      }
      setName(normalizedName);
      setStatus("Display name updated.");
      router.refresh();
    } catch (submitError) {
      setError(normalizeAuthError(submitError, "Could not update your name."));
    } finally {
      setPending(null);
    }
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("password");
    setStatus("");
    setError("");
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(
          normalizeAuthError(result.error, "Could not change your password."),
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setStatus("Password updated. Other sessions were signed out.");
    } catch (submitError) {
      setError(
        normalizeAuthError(submitError, "Could not change your password."),
      );
    } finally {
      setPending(null);
    }
  }

  async function onSignOut() {
    setPending("signout");
    setStatus("");
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(normalizeAuthError(result.error, "Could not sign out."));
        setPending(null);
        return;
      }
      window.location.assign("/login");
    } catch (submitError) {
      setError(normalizeAuthError(submitError, "Could not sign out."));
      setPending(null);
    }
  }

  return (
    <section
      className="portal-panel"
      id="account-settings"
      aria-labelledby="account-settings-title"
    >
      <h2 id="account-settings-title">Account settings</h2>
      <p className="portal-lead">
        Update your display name or password. Email stays read-only until
        verification delivery is available.
      </p>

      <form className="portal-form" onSubmit={onUpdateName}>
        <label className="portal-field">
          <span>Display name</span>
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field">
          <span>Email</span>
          <input type="email" value={email} readOnly aria-readonly="true" />
        </label>
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "name" ? "Saving…" : "Save display name"}
        </button>
      </form>

      <form className="portal-form" onSubmit={onChangePassword}>
        <label className="portal-field">
          <span>Current password</span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            disabled={pending !== null}
          />
        </label>
        <label className="portal-field">
          <span>New password</span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
            disabled={pending !== null}
          />
        </label>
        <button
          className="button button-dark"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "password" ? "Updating…" : "Change password"}
        </button>
      </form>

      <div className="portal-signout">
        <button
          className="button button-ghost"
          type="button"
          onClick={onSignOut}
          disabled={pending !== null}
        >
          {pending === "signout" ? "Signing out…" : "Sign out"}
        </button>
      </div>

      <div className="portal-status" role="status" aria-live="polite">
        {status && <p className="auth-success">{status}</p>}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </section>
  );
}
