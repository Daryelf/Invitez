"use client";

import { FormEvent, useState } from "react";
import styles from "./event-day.module.css";

export default function EventDayPinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter the 4-digit event PIN.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/event-day/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not open Event Day.");
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not open Event Day.");
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.accessPage}>
      <section className={styles.accessCard}>
        <span className={styles.monogram}>E</span>
        <p className={styles.kicker}>Private guest access</p>
        <h1>Enter Event Day</h1>
        <p>Use the four-digit PIN provided by the host.</p>
        <form onSubmit={submit}>
          <label><span>Event PIN</span><input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} autoFocus required /></label>
          {error ? <div className={styles.accessError} role="alert">{error}</div> : null}
          <button disabled={submitting}>{submitting ? "Opening…" : "Open Event Day"}</button>
        </form>
        <a href="https://www.invitez.xyz/rsvp">Return to invitation</a>
      </section>
    </main>
  );
}
