"use client";

import { FormEvent, useState } from "react";
import styles from "./admin.module.css";

type AuthResponse = {
  error?: string;
};

export default function AdminAuthForm({
  configured,
  ownerEmail,
}: {
  configured: boolean;
  ownerEmail: string;
}) {
  const [email, setEmail] = useState(ownerEmail);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setupMode = !configured;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (setupMode && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(setupMode ? "/api/admin/auth/setup" : "/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(result.error || "Could not sign in.");

      window.history.replaceState(null, "", "/admin");
      window.location.replace("/admin");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not sign in.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>{setupMode ? "Create your password" : "Invitation Studio"}</h1>
      <p>
        {setupMode
          ? "Set the password you will use to manage guests and responses."
          : "Sign in to manage guests, monitor responses, preview the invitation, and prepare event day."}
      </p>
      <form className={styles.authForm} onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            readOnly={setupMode}
            required
          />
        </label>
        <label>
          <span>{setupMode ? "Create password" : "Password"}</span>
          <div className={styles.passwordField}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={setupMode ? "new-password" : "current-password"}
              minLength={setupMode ? 8 : undefined}
              maxLength={128}
              autoFocus
              required
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {setupMode ? <small>Use at least 8 characters.</small> : null}
        </label>
        {setupMode ? (
          <label>
            <span>Confirm password</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        ) : null}
        {error ? <div className={styles.authError} role="alert">{error}</div> : null}
        <button className={styles.primaryButton} disabled={submitting}>
          {submitting ? (setupMode ? "Creating password…" : "Signing in…") : (setupMode ? "Create password & enter" : "Log in")}
        </button>
      </form>
      <div className={styles.authSecurity}>Your password is encrypted and your dashboard stays private.</div>
    </>
  );
}
