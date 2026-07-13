"use client";

import { useEffect, useRef, useState } from "react";

type IntroStage = "first" | "second";

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const eventTime = new Date("2026-10-03T19:00:00-04:00").getTime();

function Countdown() {
  const [remaining, setRemaining] = useState<CountdownValue | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const distance = Math.max(0, eventTime - Date.now());
      const totalSeconds = Math.floor(distance / 1000);
      setRemaining({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      });
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const values = remaining ?? { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const format = (value: number) => String(value).padStart(2, "0");

  return (
    <div className="countdown-panel" aria-label="Countdown to October 3 at 7 PM">
      <p className="countdown-kicker">the night begins in</p>
      <div className="countdown-grid">
        <div><strong>{format(values.days)}</strong><span>days</span></div>
        <div><strong>{format(values.hours)}</strong><span>hours</span></div>
        <div><strong>{format(values.minutes)}</strong><span>minutes</span></div>
        <div><strong>{format(values.seconds)}</strong><span>seconds</span></div>
      </div>
      <p className="countdown-date">october 03 / 07:00 pm</p>
    </div>
  );
}

function RSVPForm() {
  const [form, setForm] = useState({ name: "", email: "", attending: "yes", notes: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status !== "idle") setStatus("idle");
  }

  async function submitRSVP(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          guests: 1,
          notes: `Attendance: ${form.attending === "yes" ? "Yes" : "No"}${form.notes.trim() ? ` — ${form.notes.trim()}` : ""}`,
        }),
      });
      if (!response.ok) throw new Error("Unable to save RSVP");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="rsvp-panel" id="details" onSubmit={submitRSVP}>
      <div className="rsvp-panel-topline"><span>after hours / rsvp</span><span>03 / 10 / 26</span></div>
      <div className="rsvp-panel-heading"><span className="rsvp-bow">✦</span><h2>RSVP</h2><p>save your place for the night.</p></div>
      <label className="rsvp-field">
        <span>Name</span>
        <input required value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Your name" autoComplete="name" />
      </label>
      <label className="rsvp-field">
        <span>Email</span>
        <input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" />
      </label>
      <fieldset className="rsvp-field rsvp-attendance">
        <legend>Will you be attending?</legend>
        <div className="rsvp-options">
          <label><input type="radio" name="attending" value="yes" checked={form.attending === "yes"} onChange={(event) => updateField("attending", event.target.value)} /> <span>Yes, I’ll be there</span></label>
          <label><input type="radio" name="attending" value="no" checked={form.attending === "no"} onChange={(event) => updateField("attending", event.target.value)} /> <span>Sorry, I can’t make it</span></label>
        </div>
      </fieldset>
      <label className="rsvp-field">
        <span>Additional information <em>(optional)</em></span>
        <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Anything we should know?" rows={3} />
      </label>
      <div className="rsvp-submit-row">
        <span className={`rsvp-status rsvp-status-${status}`} aria-live="polite">{status === "saved" ? "You’re on the list." : status === "error" ? "Try again in a moment." : ""}</span>
        <button type="submit" disabled={status === "saving"}>{status === "saving" ? "SENDING…" : "SUBMIT"}</button>
      </div>
    </form>
  );
}

function IntroVideo({
  id,
  src,
  title,
  autoPlay = false,
  preload = "metadata",
  nextId,
  fullFrame = false,
  onAction,
}: {
  id: string;
  src: string;
  title: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  nextId?: string;
  fullFrame?: boolean;
  onAction?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isVisible = false;
    const playIfVisible = () => {
      if (isVisible && video.paused) {
        video.play().catch(() => undefined);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          playIfVisible();
        } else {
          video.pause();
        }
      },
      { threshold: 0.01 },
    );

    video.addEventListener("loadeddata", playIfVisible);
    video.addEventListener("canplay", playIfVisible);
    observer.observe(video);
    return () => {
      video.removeEventListener("loadeddata", playIfVisible);
      video.removeEventListener("canplay", playIfVisible);
      observer.disconnect();
    };
  }, []);

  function openNext() {
    if (!nextId) return;
    onAction?.();
  }

  return (
    <section className={`intro-panel ${fullFrame ? "intro-panel--full" : ""}`} id={id}>
      {fullFrame ? (
        <div className="vinyl-stage" aria-hidden="true">
          <img className="vinyl-record" src="/vinyl-record.png" alt="" />
        </div>
      ) : null}
      <video
        className={`intro-video ${fullFrame ? "intro-video--full" : ""}`}
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        muted
        playsInline
        preload={preload}
        aria-label={title}
      />
      {nextId ? (
        <button
          type="button"
          className="intro-action"
          aria-label="Open invitation"
          onClick={openNext}
        >
          OPEN INVITATION
        </button>
      ) : null}
      {fullFrame ? <><Countdown /><RSVPForm /></> : null}
    </section>
  );
}

export default function Home() {
  const [introStage, setIntroStage] = useState<IntroStage>("first");

  return (
    <main
      className={`intro-sequence ${introStage === "first" ? "intro-sequence--locked" : "intro-sequence--unlocked"}`}
      aria-label="After Hours invitation"
    >
      {introStage === "first" ? (
        <IntroVideo
          id="intro-first"
          src="/first.mp4"
          title="After Hours invitation"
          autoPlay
          preload="auto"
          nextId="intro-second"
          onAction={() => setIntroStage("second")}
        />
      ) : (
        <IntroVideo
          id="intro-second"
          src="/secondv2.mp4"
          title="After Hours invitation transition"
          autoPlay
          preload="auto"
          fullFrame
        />
      )}
    </main>
  );
}
