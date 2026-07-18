"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_RSVP_LAYOUT, normalizeRsvpLayout, rsvpLayoutVariables } from "@/lib/rsvp-layout";

type IntroStage = "first" | "second";

type EventInfo = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventIso: string;
  venue: string;
  address: string;
  mapUrl: string;
};

type ConfirmationData = {
  guest: { name: string; status: "attending" | "declined" };
  event: EventInfo;
};

const fallbackEvent: EventInfo = {
  eventName: "Erika's Sweet 16",
  eventDate: "October 3, 2026",
  eventTime: "7:00 PM",
  eventIso: "2026-10-03T19:00:00-04:00",
  venue: "Centerville Banquet Hall",
  address: "",
  mapUrl: "",
};

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
    <div className="countdown-panel" id="details" aria-label="Countdown to October 3 at 7 PM">
      <div className="countdown-bloom countdown-bloom--left" aria-hidden="true">
        <span /><span /><span /><span /><span /><i />
      </div>
      <div className="countdown-bloom countdown-bloom--right" aria-hidden="true">
        <span /><span /><span /><span /><span /><i />
      </div>
      <div className="countdown-bow" aria-hidden="true"><span /><span /><i /></div>
      <p className="countdown-kicker">countdown to the ball</p>
      <div className="countdown-grid">
        <div><strong>{format(values.days)}</strong><span>days</span></div>
        <div><strong>{format(values.hours)}</strong><span>hours</span></div>
        <div><strong>{format(values.minutes)}</strong><span>minutes</span></div>
        <div><strong>{format(values.seconds)}</strong><span>seconds</span></div>
      </div>
      <p className="countdown-date"><span aria-hidden="true">♥</span> october 3rd, 2026 · 7:00 pm <span aria-hidden="true">♥</span></p>
    </div>
  );
}

function RSVPHotspots({ onConfirmed }: { onConfirmed: (confirmation: ConfirmationData) => void }) {
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [layout, setLayout] = useState(DEFAULT_RSVP_LAYOUT);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/invitation-layout", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Layout unavailable")))
      .then((result: { layout?: unknown }) => setLayout(normalizeRsvpLayout(result.layout)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLayout(DEFAULT_RSVP_LAYOUT);
      });
    return () => controller.abort();
  }, []);

  async function submitRSVP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitState("submitting");

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          attending: formData.get("attending"),
          additionalInformation: formData.get("additionalInformation"),
        }),
      });
      if (!response.ok) throw new Error("Could not submit RSVP");
      const result = await response.json() as { event?: EventInfo };
      const confirmation: ConfirmationData = {
        guest: {
          name: String(formData.get("name") || "Guest"),
          status: formData.get("attending") === "yes" ? "attending" : "declined",
        },
        event: result.event || fallbackEvent,
      };
      window.localStorage.setItem("invitez-rsvp-confirmation", JSON.stringify(confirmation));
      form.reset();
      setSubmitState("success");
      onConfirmed(confirmation);
      const invitation = form.closest<HTMLElement>(".intro-sequence");
      window.setTimeout(() => invitation?.scrollTo({ top: invitation.scrollHeight, behavior: "smooth" }), 100);
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <form
      className="rsvp-hotspots"
      style={rsvpLayoutVariables(layout) as CSSProperties}
      aria-label="RSVP form fields"
      onSubmit={submitRSVP}
    >
      <label className="rsvp-text-hotspot rsvp-name-hotspot">
        <span className="sr-only">Name</span>
        <input type="text" name="name" autoComplete="name" placeholder="Name" required />
      </label>
      <fieldset className="rsvp-attendance-hotspots">
        <legend className="sr-only">Will you be attending?</legend>
        <label className="rsvp-radio-hotspot rsvp-radio-hotspot--yes">
          <input type="radio" name="attending" value="yes" required />
          <span aria-hidden="true" />
          <span className="sr-only">Yes, I will be there</span>
        </label>
        <label className="rsvp-radio-hotspot rsvp-radio-hotspot--no">
          <input type="radio" name="attending" value="no" />
          <span aria-hidden="true" />
          <span className="sr-only">Sorry, I cannot make it</span>
        </label>
      </fieldset>
      <label className="rsvp-text-hotspot rsvp-notes-hotspot">
        <span className="sr-only">Additional information</span>
        <textarea name="additionalInformation" placeholder="Additional information" />
      </label>
      <button
        type="submit"
        className="rsvp-submit-hotspot"
        aria-label="Submit RSVP"
        disabled={submitState === "submitting"}
      >
        Submit RSVP
      </button>
      <p className={`rsvp-submit-status rsvp-submit-status--${submitState}`} aria-live="polite">
        {submitState === "success" ? "RSVP sent!" : submitState === "error" ? "Please try again" : ""}
      </p>
    </form>
  );
}

function IntroVideo({
  id,
  src,
  poster,
  title,
  autoPlay = false,
  preload = "metadata",
  nextId,
  fullFrame = false,
  onAction,
  vinylPaused = false,
  onVinylToggle,
  onRSVPConfirmed,
  confirmation,
}: {
  id: string;
  src: string;
  poster: string;
  title: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  nextId?: string;
  fullFrame?: boolean;
  onAction?: () => void;
  vinylPaused?: boolean;
  onVinylToggle?: () => void;
  onRSVPConfirmed?: (confirmation: ConfirmationData) => void;
  confirmation?: ConfirmationData | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showAutoplayFallback, setShowAutoplayFallback] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isVisible = false;
    const playIfVisible = () => {
      if (isVisible && video.paused) {
        video.muted = true;
        video.play()
          .then(() => setShowAutoplayFallback(false))
          .catch(() => setShowAutoplayFallback(true));
      }
    };

    const showFallbackIfBlocked = () => {
      if (isVisible && video.paused && video.currentTime < 0.1) {
        setShowAutoplayFallback(true);
      }
    };

    const hideFallback = () => setShowAutoplayFallback(false);

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
    video.addEventListener("playing", hideFallback);
    observer.observe(video);
    const fallbackTimer = window.setTimeout(showFallbackIfBlocked, 500);
    return () => {
      video.removeEventListener("loadeddata", playIfVisible);
      video.removeEventListener("canplay", playIfVisible);
      video.removeEventListener("playing", hideFallback);
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  function openNext() {
    if (!nextId) return;
    onAction?.();
  }

  return (
    <section className={`intro-panel ${fullFrame ? "intro-panel--full" : ""}`} id={id}>
      {fullFrame ? (
        <div className="vinyl-stage">
          <img
            className={`vinyl-record ${vinylPaused ? "vinyl-record--paused" : ""}`}
            src="/vinyl-record.png"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
          />
          <button
            type="button"
            className="vinyl-toggle"
            aria-label={vinylPaused ? "Play vinyl" : "Pause vinyl"}
            aria-pressed={vinylPaused}
            onClick={onVinylToggle}
          >
            <span aria-hidden="true">{vinylPaused ? "▶" : "❚❚"}</span>
          </button>
        </div>
      ) : null}
      <video
        className={`intro-video ${fullFrame ? "intro-video--full" : ""}`}
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted
        playsInline
        preload={preload}
        aria-label={title}
      />
      <img
        className={`intro-video autoplay-poster ${fullFrame ? "intro-video--full autoplay-poster--full" : ""}`}
        src={poster}
        alt=""
        aria-hidden="true"
        hidden={!showAutoplayFallback}
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
      {fullFrame ? (
        <>
          {confirmation ? (
            <CompactRSVPConfirmation confirmation={confirmation} />
          ) : (
            <RSVPHotspots onConfirmed={onRSVPConfirmed || (() => undefined)} />
          )}
          <Countdown />
        </>
      ) : null}
    </section>
  );
}

function CompactRSVPConfirmation({ confirmation }: {
  confirmation: ConfirmationData;
}) {
  const attending = confirmation.guest.status === "attending";

  return (
    <aside className="rsvp-confirmation-card" role="status" aria-live="polite" aria-label="RSVP confirmation">
      <span className="rsvp-confirmation-mark" aria-hidden="true">✓</span>
      <div className="rsvp-confirmation-copy">
        <strong>Your RSVP is in</strong>
        <span>{attending ? `See you there, ${confirmation.guest.name}!` : `Thank you, ${confirmation.guest.name}.`}</span>
      </div>
    </aside>
  );
}

export default function Home() {
  const [introStage, setIntroStage] = useState<IntroStage>("first");
  const [vinylPaused, setVinylPaused] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const initializeScreen = async () => {
      const song = audioRef.current;
      if (song) {
        song.pause();
        song.currentTime = 0;
      }
      setVinylPaused(false);
      try {
        const eventDay = await fetch("/api/event-day", { cache: "no-store" });
        if (eventDay.ok) {
          const result = await eventDay.json() as { active?: boolean };
          if (result.active) {
            window.location.replace("/event-day");
            return;
          }
        }
      } catch {
        // The invitation remains available if event-day status cannot load.
      }
      const savedConfirmation = window.localStorage.getItem("invitez-rsvp-confirmation");
      if (savedConfirmation) {
        try {
          const parsed = JSON.parse(savedConfirmation) as ConfirmationData;
          setConfirmation(parsed);
          setIntroStage("second");
        } catch {
          window.localStorage.removeItem("invitez-rsvp-confirmation");
        }
      } else {
        const fresh = new URLSearchParams(window.location.search).get("fresh") === "1";
        setIntroStage(window.localStorage.getItem("invitez-opening-viewed") === "1" && !fresh ? "second" : "first");
      }
      window.scrollTo(0, 0);
    };

    const onPageShow = () => { void initializeScreen(); };
    window.addEventListener("pageshow", onPageShow);
    void initializeScreen();
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  function openSecondInvitation() {
    window.localStorage.setItem("invitez-opening-viewed", "1");
    const song = audioRef.current;
    if (song) {
      song.currentTime = 0;
      song.play().then(() => setVinylPaused(false)).catch(() => setVinylPaused(true));
    }
    setIntroStage("second");
  }

  function showConfirmation(next: ConfirmationData) {
    setConfirmation(next);
    setIntroStage("second");
  }

  function toggleVinylAndSong() {
    const song = audioRef.current;
    if (!song) return;

    if (vinylPaused) {
      song.play().then(() => setVinylPaused(false)).catch(() => setVinylPaused(true));
    } else {
      song.pause();
      setVinylPaused(true);
    }
  }

  return (
    <div className="device-shell">
      <div className="device-camera" aria-hidden="true"><span /></div>
      <main
        className={`intro-sequence ${introStage === "first" ? "intro-sequence--locked" : "intro-sequence--unlocked"}`}
        aria-label="After Hours invitation"
      >
        <audio
          ref={audioRef}
          src="/Nicki Minaj - Moment 4 Life (Remastered) (Official Video) ft. Drake - NickiMinajAtVEVO.mp3"
          preload="auto"
        />
        {introStage === "first" ? (
          <IntroVideo
            id="intro-first"
            src="/first.mp4"
            poster="/first-poster.png"
            title="After Hours invitation"
            autoPlay
            preload="auto"
            nextId="intro-second"
            onAction={openSecondInvitation}
          />
        ) : (
          <IntroVideo
            id="intro-second"
            src="/secondv2.mp4"
            poster="/secondv2-poster.png"
            title="After Hours invitation transition"
            autoPlay
            preload="auto"
            fullFrame
            vinylPaused={vinylPaused}
            onVinylToggle={toggleVinylAndSong}
            onRSVPConfirmed={showConfirmation}
            confirmation={confirmation}
          />
        )}
      </main>
      <div className="device-home-indicator" aria-hidden="true" />
    </div>
  );
}
