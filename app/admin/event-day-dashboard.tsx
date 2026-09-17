"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string; eventDate: string; eventTime: string; venue: string } | null;
};

type GalleryPhoto = { id: string; url: string; createdAt: string };

const EVENT_DAY_URL = "https://www.invitez.xyz/event-day";

export default function EventDayDashboard() {
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy guest link");

  const load = useCallback(async () => {
    try {
      const [eventResponse, photoResponse] = await Promise.all([
        fetch("/api/event-day", { cache: "no-store" }),
        fetch("/api/photos", { cache: "no-store" }),
      ]);
      if (eventResponse.ok) setEventDay(await eventResponse.json() as EventDayData);
      if (photoResponse.ok) {
        const result = await photoResponse.json() as { photos?: GalleryPhoto[] };
        setPhotos(result.photos ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(refreshTimer);
  }, [load]);

  async function copyGuestLink() {
    try {
      await navigator.clipboard.writeText(EVENT_DAY_URL);
      setCopyLabel("Guest link copied");
      window.setTimeout(() => setCopyLabel("Copy guest link"), 2200);
    } catch {
      window.prompt("Copy the Event Day guest link", EVENT_DAY_URL);
    }
  }

  return (
    <section className={styles.eventDayDashboard}>
      <div className={styles.eventDayHero}>
        <div>
          <p className={styles.eyebrow}>Event Day live gallery</p>
          <h2>Guest photos,<br />all in one place.</h2>
          <p>Share the QR code at the event. Guests can add photos from their phones, and every upload appears in the gallery here.</p>
        </div>
        <div className={styles.eventDayActions}>
          <button className={styles.secondaryButton} type="button" onClick={copyGuestLink}>{copyLabel}</button>
          <a className={styles.primaryButton} href={EVENT_DAY_URL} target="_blank" rel="noreferrer">Open Event Day</a>
        </div>
      </div>

      <div className={styles.eventDayGrid}>
        <article className={styles.eventQrCard}>
          <div className={styles.eventQrTopline}><span>Guest upload</span><strong>Scan me</strong></div>
          <div className={styles.eventQrFrame}><img src="/event-upload-qr.svg" alt="QR code for the Event Day guest photo page" /></div>
          <h3>Scan to share photos</h3>
          <p>The Event Day PIN still protects the page. Put the PIN next to this code when you print or display it.</p>
        </article>

        <article className={styles.eventSummary}>
          <div className={styles.eventStatus}><i className={eventDay?.active ? styles.eventStatusLive : ""} /><span>{eventDay?.active ? "Event Day is live" : "Scheduled for event day"}</span></div>
          <div className={styles.eventMemoryCount}><strong>{loading ? "—" : photos.length}</strong><span>{photos.length === 1 ? "photo shared" : "photos shared"}</span></div>
          <dl>
            <div><dt>Event</dt><dd>{eventDay?.event?.eventName ?? "Your event"}</dd></div>
            <div><dt>When</dt><dd>{eventDay?.event ? `${eventDay.event.eventDate} · ${eventDay.event.eventTime}` : "Loading…"}</dd></div>
            <div><dt>Uploads</dt><dd>{eventDay?.photoUploadsEnabled ? "Open when Event Day is live" : "Paused"}</dd></div>
          </dl>
          <button className={styles.secondaryButton} type="button" onClick={() => void load()}>Refresh gallery</button>
        </article>
      </div>

      <section className={styles.eventPhotoPanel}>
        <div className={styles.eventPhotoHeader}>
          <div><p className={styles.eyebrow}>Live from the guests</p><h3>Shared photos</h3></div>
          <span>{photos.length} {photos.length === 1 ? "memory" : "memories"}</span>
        </div>
        {photos.length > 0 ? (
          <div className={styles.eventPhotoGrid}>
            {photos.map((photo, index) => <img key={photo.id} src={photo.url} alt={`Event photo ${index + 1}`} loading="lazy" />)}
          </div>
        ) : (
          <div className={styles.eventPhotoEmpty}><span>＋</span><strong>The gallery is ready</strong><p>Guest photos will appear here as soon as they are uploaded.</p></div>
        )}
      </section>
    </section>
  );
}
