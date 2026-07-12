"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type GalleryPhoto = {
  id: string;
  name: string;
  caption: string | null;
  url: string;
  createdAt: string;
};

const eventDetails = {
  date: "Saturday, August 15, 2026",
  time: "9:00 PM — late",
  city: "Brooklyn, NY",
};

const starterPhotos = [
  { id: "starter-1", src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=85", alt: "Crowd dancing under red light" },
  { id: "starter-2", src: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=85", alt: "Hands up at a live show" },
  { id: "starter-3", src: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=85", alt: "Friends laughing at a party" },
];

function ArrowUpRight() {
  return <span aria-hidden="true" className="arrow-icon">↗</span>;
}

function IntroVideo({ id, src, number, title, nextHref, panelRef }: { id: string; src: string; number: string; title: string; nextHref: string; panelRef?: { current: HTMLElement | null } }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.55 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="intro-panel" id={id} ref={panelRef}>
      <video className="intro-video" ref={videoRef} src={src} autoPlay muted playsInline preload="auto" aria-label={`${title} intro animation`} />
      <div className="intro-scrim" />
      <div className="intro-panel-top"><span>after hours / intro</span><span>{number} / 02</span></div>
      <div className="intro-panel-title"><span className="eyebrow"><span className="eyebrow-dot" /> before you enter</span><h2>{title}</h2></div>
      <a className="intro-scroll" href={nextHref}><span>scroll to continue</span><strong>↓</strong></a>
    </section>
  );
}

export default function Home() {
  const [showRSVP, setShowRSVP] = useState(false);
  const [rsvpState, setRsvpState] = useState({ name: "", email: "", guests: "1", notes: "" });
  const [rsvpStatus, setRsvpStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [rsvpCount, setRsvpCount] = useState(0);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  const introSecondRef = useRef<HTMLElement | null>(null);
  const introSecondLockedRef = useRef(false);

  useEffect(() => {
    const secondPanel = introSecondRef.current;
    if (!secondPanel) return;

    const syncIntroLock = () => {
      const secondTop = secondPanel.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY >= secondTop - 2) {
        introSecondLockedRef.current = true;
      }
      if (introSecondLockedRef.current && window.scrollY < secondTop) {
        window.scrollTo({ top: secondTop, behavior: "auto" });
      }
    };

    syncIntroLock();
    window.addEventListener("scroll", syncIntroLock, { passive: true });
    return () => window.removeEventListener("scroll", syncIntroLock);
  }, []);

  const allPhotos = useMemo(() => {
    return [
      ...gallery,
      ...starterPhotos.map((photo) => ({ ...photo, isStarter: true })),
    ];
  }, [gallery]);

  useEffect(() => {
    fetch("/api/rsvp")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setRsvpCount(data.totalGuests ?? 0))
      .catch(() => undefined);

    fetch("/api/photos")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data && setGallery(data.photos ?? []))
      .catch(() => undefined);
  }, []);

  function toggleMusic() {
    if (isPlaying) {
      if (musicTimerRef.current) window.clearInterval(musicTimerRef.current);
      musicTimerRef.current = null;
      audioContextRef.current?.suspend();
      setIsPlaying(false);
      return;
    }
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    context.resume();
    const playBeat = () => {
      const step = beatRef.current++ % 8;
      const now = context.currentTime;
      const tone = (frequency: number, duration: number, type: OscillatorType, volume: number) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
      };
      tone(step % 4 === 0 ? 72 : 145, step % 4 === 0 ? 0.24 : 0.06, step % 4 === 0 ? "sine" : "square", step % 4 === 0 ? 0.18 : 0.025);
      if (step === 0 || step === 4) tone(49, 0.4, "triangle", 0.12);
      if (step % 2 === 0) tone(880, 0.025, "square", 0.012);
    };
    playBeat();
    musicTimerRef.current = window.setInterval(playBeat, 375);
    setIsPlaying(true);
  }

  function updateRSVP(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setRsvpState((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitRSVP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRsvpStatus("saving");
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rsvpState),
      });
      if (!response.ok) throw new Error("Unable to save RSVP");
      const data = await response.json();
      setRsvpCount(data.totalGuests ?? rsvpCount + Number(rsvpState.guests));
      setRsvpStatus("saved");
    } catch {
      setRsvpStatus("error");
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setUploadState("idle");
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    setUploadState("uploading");
    const formData = new FormData();
    formData.append("photo", selectedFile);
    formData.append("caption", caption);
    try {
      const response = await fetch("/api/photos", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Unable to upload photo");
      const data = await response.json();
      setGallery((current) => [data.photo, ...current]);
      setSelectedFile(null);
      setCaption("");
      setUploadState("uploaded");
    } catch {
      setUploadState("error");
    }
  }

  return (
    <main className="site-shell">
      <section className="intro-sequence" id="intro" aria-label="Event introduction">
        <IntroVideo id="intro-first" src="/first.mp4" number="01" title="The invitation" nextHref="#intro-second" />
        <IntroVideo id="intro-second" src="/seconds.mp4" number="02" title="The night begins" nextHref="#details" panelRef={introSecondRef} />
      </section>

      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="#intro" aria-label="After Hours home">AH<span>•</span></a>
        <div className="nav-links">
          <a href="#details">The details</a>
          <a href="#gallery">The gallery</a>
        </div>
        <button className="music-button" onClick={toggleMusic} type="button" aria-pressed={isPlaying}>
          <span className={`sound-bars ${isPlaying ? "is-playing" : ""}`} aria-hidden="true"><i /><i /><i /></span>
          {isPlaying ? "Pause track" : "Play the track"}
        </button>
      </nav>

      <section className="hero" id="top">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> an after-hours gathering</p>
          <h1>Come for<br /><em>the plot.</em><br />Stay for the <span>music.</span></h1>
          <p className="hero-lede">One night. A room full of good people. The kind of party you’ll still be talking about on Monday.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => setShowRSVP(true)} type="button">RSVP now <ArrowUpRight /></button>
            <a className="text-link" href="#details">See the details <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-poster" aria-label="After Hours event poster">
          <div className="poster-sticker">you<br />in?</div>
          <div className="poster-topline">after hours / 001</div>
          <div className="poster-title"><span>THE</span><strong>NIGHT<br />SHIFT</strong></div>
          <div className="poster-center-mark">✳</div>
          <div className="poster-footline"><span>15.08.26</span><span>brooklyn, ny</span></div>
          <div className="poster-scribble">good<br />energy<br />only</div>
        </div>
        <div className="hero-meta"><span>scroll to enter</span><span className="scroll-line" /></div>
      </section>

      <section className="details-section" id="details">
        <div className="section-kicker">01 / the invitation</div>
        <div className="details-grid">
          <div>
            <h2>Bring your favorite<br /><span>version of yourself.</span></h2>
          </div>
          <div className="details-body">
            <p className="large-copy">No dress code. No plus-one politics. Just a warm room, a loud sound system, and the people you want to lose track of time with.</p>
            <div className="detail-list">
              <div><span>When</span><strong>{eventDetails.date}<br />{eventDetails.time}</strong></div>
              <div><span>Where</span><strong>{eventDetails.city}<br /><small>address shared after RSVP</small></strong></div>
              <div><span>Sound</span><strong>live sets + <br />late-night selectors</strong></div>
            </div>
            <button className="button button-dark" onClick={() => setShowRSVP(true)} type="button">Save me a spot <ArrowUpRight /></button>
          </div>
        </div>
      </section>

      <section className="signal-section">
        <div className="signal-ticket"><span>RSVP signal</span><strong>{rsvpCount > 0 ? `${rsvpCount} ${rsvpCount === 1 ? "person is" : "people are"}` : "the first people are"}<br />already on the list.</strong><button type="button" onClick={() => setShowRSVP(true)}>Add your name <ArrowUpRight /></button></div>
        <div className="signal-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="section-heading-row">
          <div><div className="section-kicker">02 / leave a trace</div><h2>The night,<br /><span>through your eyes.</span></h2></div>
          <p>After the party, drop your favorite frame here. The gallery belongs to everyone who was in the room.</p>
        </div>
        <div className="gallery-grid">
          {allPhotos.map((photo, index) => (
            <figure className={`gallery-card gallery-card-${(index % 3) + 1}`} key={photo.id}>
              <img src={photo.src ?? photo.url} alt={photo.alt ?? photo.caption ?? "A guest photo from the night"} />
              {photo.caption && <figcaption>{photo.caption}</figcaption>}
            </figure>
          ))}
          <form className="upload-card" onSubmit={uploadPhoto}>
            <label className="upload-dropzone">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} />
              <span className="upload-plus">+</span>
              <strong>{selectedFile ? selectedFile.name : "Add your photo"}</strong>
              <span>{selectedFile ? "ready to send" : "jpg, png, or webp · 10mb max"}</span>
            </label>
            <input className="caption-input" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Add a caption (optional)" aria-label="Photo caption" />
            <button className="button button-dark upload-button" type="submit" disabled={!selectedFile || uploadState === "uploading"}>{uploadState === "uploading" ? "Sending..." : "Share it"} <ArrowUpRight /></button>
            {uploadState === "uploaded" && <span className="form-success">Your photo is in the gallery.</span>}
            {uploadState === "error" && <span className="form-error">That upload didn’t go through. Try again.</span>}
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-mark">AH<span>•</span></div>
        <p>made for the people who<br />stay a little longer.</p>
        <div className="footer-right"><span>see you on the other side</span><a href="#top">back to top ↑</a></div>
      </footer>

      {showRSVP && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRSVP(false)}>
          <section className="rsvp-modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-title">
            <button className="modal-close" type="button" aria-label="Close RSVP form" onClick={() => setShowRSVP(false)}>×</button>
            {rsvpStatus === "saved" ? (
              <div className="success-state"><div className="success-star">✳</div><p className="eyebrow">you’re on the list</p><h2>See you<br /><em>after hours.</em></h2><p>We saved your RSVP. The address and final details will land in your inbox soon.</p><button className="button button-dark" onClick={() => setShowRSVP(false)} type="button">Done <ArrowUpRight /></button></div>
            ) : (
              <>
                <p className="eyebrow">the night shift / RSVP</p>
                <h2 id="rsvp-title">Save your<br /><em>spot.</em></h2>
                <form className="rsvp-form" onSubmit={submitRSVP}>
                  <label>Name<input name="name" value={rsvpState.name} onChange={updateRSVP} required placeholder="Your name" /></label>
                  <label>Email<input type="email" name="email" value={rsvpState.email} onChange={updateRSVP} required placeholder="you@email.com" /></label>
                  <div className="form-row"><label>Bringing<select name="guests" value={rsvpState.guests} onChange={updateRSVP}><option value="1">Just me</option><option value="2">Me + 1</option><option value="3">Me + 2</option><option value="4">Me + 3</option></select></label><label>Note (optional)<input name="notes" value={rsvpState.notes} onChange={updateRSVP} placeholder="Anything we should know?" /></label></div>
                  <button className="button button-primary form-submit" disabled={rsvpStatus === "saving"} type="submit">{rsvpStatus === "saving" ? "Saving..." : "I’m coming"} <ArrowUpRight /></button>
                  {rsvpStatus === "error" && <p className="form-error">Couldn’t save that RSVP. Please try again.</p>}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
