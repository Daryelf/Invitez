"use client";

import { FormEvent, useState } from "react";
import styles from "./admin.module.css";

type AuthResponse = {
  error?: string;
};

export default function AdminAuthForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter your 4-digit PIN.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
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
      <h1>Invitation Studio</h1>
      <p>Enter your PIN to manage guests, responses, and the invitation.</p>
      <form className={styles.authForm} onSubmit={submit}>
        <label>
          <span>4-digit PIN</span>
          <input
            className={styles.pinInput}
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            pattern="[0-9]{4}"
            autoComplete="current-password"
            maxLength={4}
            aria-label="4-digit admin PIN"
            autoFocus
            required
          />
        </label>
        {error ? <div className={styles.authError} role="alert">{error}</div> : null}
        <button className={styles.primaryButton} disabled={submitting}>
          {submitting ? "Unlocking…" : "Enter studio"}
        </button>
      </form>
      <div className={styles.authSecurity}>Private PIN access.</div>
    </>
  );
}
