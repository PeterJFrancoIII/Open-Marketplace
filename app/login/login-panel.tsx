"use client";

import { type FormEvent, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { sanitizeReturnTo } from "../../lib/auth-return-to";

type Mode = "login" | "register";

export default function LoginPanel({ returnTo }: { returnTo: string }) {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");

    try {
      if (mode === "register") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message || "Account creation failed.");
          return;
        }
        setMode("login");
        setPassword("");
        setStatus("Account created. Log in to continue.");
        return;
      }

      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
      });
      if (result.error) {
        setError(result.error.message || "Log in failed.");
        return;
      }
      window.location.assign(safeReturnTo);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="auth-eyebrow">Account</p>
      <h1 id="auth-title">
        {mode === "login" ? "Log in to Open Marketplace" : "Create account"}
      </h1>
      <p className="auth-lead">
        Passwords require at least 12 characters. Accounts are for publishing
        and managing listings; browsing stays open without signing in.
      </p>

      <div className="auth-mode-switch" role="tablist" aria-label="Account mode">
        <button
          type="button"
          className={`button ${mode === "login" ? "button-dark" : "button-ghost"}`}
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => {
            setError("");
            setMode("login");
          }}
        >
          Log in
        </button>
        <button
          type="button"
          className={`button ${mode === "register" ? "button-dark" : "button-ghost"}`}
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => {
            setError("");
            setMode("register");
          }}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {mode === "register" && (
          <label className="auth-field">
            <span>Display name</span>
            <input
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
          </label>
        )}

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </label>

        {mode === "login" && (
          <label className="auth-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me</span>
          </label>
        )}

        <button className="button button-login auth-submit" type="submit" disabled={pending}>
          {pending
            ? mode === "login"
              ? "Signing in…"
              : "Creating account…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <div className="auth-status" role="status" aria-live="polite">
        {status && <p className="auth-success">{status}</p>}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </section>
  );
}
