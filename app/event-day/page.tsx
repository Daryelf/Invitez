"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./event-day.module.css";

type EventInfo = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventIso: string;
  venue: string;
  address: string;
  mapUrl: string;
};

type Photo = {
  id: string;
  name: string;
  caption: string | null;
  url: string;
  createdAt: string;
};

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: EventInfo | null;
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

function photoTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function EventDayPage() {
  const [data, setData] = useState<EventDayData>({ active: false, photoUploadsEnabled: false, event: fallbackEvent });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1");
  const [guestName] = useState(() => typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("guest") || "").slice(0, 80) : "");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadPhotos() {
    const response = await fetch("/api/photos", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { photos?: Photo[] };
    setPhotos(result.photos || []);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/event-day", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("Event information is temporarily unavailable");
        return response.json() as Promise<EventDayData>;
      }),
      fetch("/api/photos", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ photos?: Photo[] }> : { photos: [] }),
    ])
      .then(([eventData, photoData]) => {
        setData(eventData);
        setPhotos(photoData.photos || []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load event day"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const event = data.event || fallbackEvent;
  const experienceVisible = data.active || preview;
  const uploadAllowed = data.active && data.photoUploadsEnabled;
  const mapLink = useMemo(() => event.mapUrl || (event.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}` : ""), [event]);

  function selectPhoto(changeEvent: ChangeEvent<HTMLInputElement>) {
    const nextFile = changeEvent.target.files?.[0] || null;
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(nextFile);
    setFilePreview(nextFile ? URL.createObjectURL(nextFile) : "");
    setError("");
  }

  async function uploadPhoto(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!file || !uploadAllowed) return;
    setUploading(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.set("photo", file);
    body.set("caption", caption);

    try {
      const response = await fetch("/api/photos", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not upload that photo");
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFile(null);
      setFilePreview("");
      setCaption("");
      setNotice("Your memory is on the party wall!");
      await loadPhotos();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload that photo");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <main className={styles.loading}><span /><p>Preparing the party…</p></main>;
  }

  if (!experienceVisible) {
    return (
      <main className={styles.prelaunch}>
        <div className={styles.prelaunchFlowers} aria-hidden="true"><i /><i /><i /></div>
        <section className={styles.prelaunchCard}>
          <span className={styles.monogram}>E</span>
          <p className={styles.kicker}>A little magic is waiting</p>
          <h1>Come back on<br />event day</h1>
          <div className={styles.datePill}>{event.eventDate} · {event.eventTime}</div>
          <p>On the day of the party, this link becomes a shared photo experience for every guest.</p>
          <a href="https://www.invitez.xyz">View invitation details</a>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.eventPage}>
      <header className={styles.eventHeader}>
        <div className={styles.brand}><span>E</span><div><strong>{event.eventName}</strong><small>Event day</small></div></div>
        <div className={styles.liveBadge}><i />{preview && !data.active ? "Preview mode" : "Live at the party"}</div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroButterfly} aria-hidden="true">⌁</div>
        <p className={styles.kicker}>{guestName ? `Welcome, ${guestName}` : "Welcome to the celebration"}</p>
        <h1>Capture the<br /><em>magic.</em></h1>
        <p className={styles.heroCopy}>Share your favorite moments so Erika can keep every memory from tonight in one beautiful place.</p>
        <div className={styles.eventFacts}>
          <div><span>Date</span><strong>{event.eventDate}</strong></div>
          <div><span>Time</span><strong>{event.eventTime}</strong></div>
          <div><span>Venue</span><strong>{event.venue}</strong></div>
        </div>
        {event.address ? <p className={styles.address}>{mapLink ? <a href={mapLink} target="_blank" rel="noreferrer">{event.address} ↗</a> : event.address}</p> : null}
      </section>

      <section className={styles.uploadSection}>
        <div className={styles.sectionHeading}><span>01</span><div><p className={styles.kicker}>Add to the story</p><h2>Share a photo</h2></div></div>
        <form className={styles.uploadCard} onSubmit={uploadPhoto}>
          <label className={`${styles.dropZone} ${filePreview ? styles.dropZoneSelected : ""}`}>
            {filePreview ? <img src={filePreview} alt="Selected upload preview" /> : <><span className={styles.cameraIcon}>＋</span><strong>Choose a photo</strong><small>Tap to open your camera or photo library</small></>}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectPhoto} disabled={!uploadAllowed} />
          </label>
          <label className={styles.captionField}><span>Say something about this moment</span><input value={caption} onChange={(captionEvent) => setCaption(captionEvent.target.value)} maxLength={140} placeholder="A memory, a wish, or who is in the photo…" disabled={!uploadAllowed} /></label>
          {!uploadAllowed ? <p className={styles.previewNotice}>{preview && !data.active ? "Uploads are disabled in preview. Turn on event-day mode to test a real upload." : "Photo uploads are paused by the host."}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.success}>{notice}</p> : null}
          <button disabled={!file || !uploadAllowed || uploading}>{uploading ? "Adding your memory…" : "Add to the party wall"}</button>
        </form>
      </section>

      <section className={styles.gallerySection}>
        <div className={styles.sectionHeading}><span>02</span><div><p className={styles.kicker}>Made by everyone</p><h2>Party wall</h2></div><small>{photos.length} {photos.length === 1 ? "memory" : "memories"}</small></div>
        {photos.length ? (
          <div className={styles.gallery}>
            {photos.map((photo, index) => <figure key={photo.id} className={styles[`tile${index % 3}`]}><img src={photo.url} alt={photo.caption || photo.name} loading="lazy" /><figcaption><span>{photo.caption || "A moment from the party"}</span><time>{photoTime(photo.createdAt)}</time></figcaption></figure>)}
          </div>
        ) : (
          <div className={styles.emptyGallery}><span>♡</span><strong>The first memory starts here</strong><p>Photos shared by guests will fill this party wall.</p></div>
        )}
      </section>

      <footer className={styles.footer}><span>Erika&apos;s</span><p>Sweet sixteen · {event.eventDate}</p></footer>
    </main>
  );
}
