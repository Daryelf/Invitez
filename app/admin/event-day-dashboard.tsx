"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./admin.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string; eventDate: string; eventTime: string; venue: string } | null;
};

type GalleryPhoto = { id: string; url: string; contentType: string; createdAt: string };

const EVENT_DAY_URL = "https://www.invitez.xyz/share-photos";
const EVENT_QR_URL = "/event-upload-qr.svg";

export default function EventDayDashboard() {
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy guest link");
  const [qrExpanded, setQrExpanded] = useState(false);

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

  useEffect(() => {
    if (!qrExpanded) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setQrExpanded(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [qrExpanded]);

  async function copyGuestLink() {
    try {
      await navigator.clipboard.writeText(EVENT_DAY_URL);
      setCopyLabel("Guest link copied");
      window.setTimeout(() => setCopyLabel("Copy guest link"), 2200);
    } catch {
      window.prompt("Copy the guest photo link", EVENT_DAY_URL);
    }
  }

  return (
    <section className={styles.eventDayDashboard}>
      <div className={styles.eventDayGrid}>
        <article className={styles.eventQrCard}>
          <div className={styles.eventQrTopline}><span>Guest upload</span><strong>Scan me</strong></div>
          <button className={styles.eventQrFrame} type="button" onClick={() => setQrExpanded(true)} aria-label="Enlarge guest upload QR code">
            <img src={EVENT_QR_URL} alt="QR code for the Event Day guest photo page" />
          </button>
          <div className={styles.eventQrActions}>
            <button type="button" onClick={() => setQrExpanded(true)}>Enlarge</button>
            <a href={EVENT_QR_URL} download="Erikas-Sweet-16-guest-upload-QR.svg">Download QR</a>
          </div>
        </article>

        <article className={styles.eventSummary}>
          <div className={styles.eventSummaryTopline}>
            <div className={styles.eventStatus}><i className={eventDay?.active ? styles.eventStatusLive : ""} /><span>{eventDay?.active ? "Event Day is live" : "Scheduled for event day"}</span></div>
            <div className={styles.eventMemoryCount}><strong>{loading ? "—" : photos.length}</strong><span>{photos.length === 1 ? "memory shared" : "memories shared"}</span></div>
          </div>
          <dl>
            <div><dt>Event</dt><dd>{eventDay?.event?.eventName ?? "Your event"}</dd></div>
            <div><dt>When</dt><dd>{eventDay?.event ? `${eventDay.event.eventDate} · ${eventDay.event.eventTime}` : "Loading…"}</dd></div>
            <div><dt>Uploads</dt><dd>{eventDay?.photoUploadsEnabled ? "Open when Event Day is live" : "Paused"}</dd></div>
          </dl>
          <div className={styles.eventSummaryActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => void load()}>Refresh gallery</button>
            <button className={styles.secondaryButton} type="button" onClick={copyGuestLink}>{copyLabel}</button>
            <a className={styles.primaryButton} href={EVENT_DAY_URL} target="_blank" rel="noreferrer">Open guest upload</a>
          </div>
        </article>
      </div>

      <section className={styles.eventPhotoPanel}>
        <div className={styles.eventPhotoHeader}>
          <div><p className={styles.eyebrow}>Live from the guests</p><h3>Shared memories</h3></div>
          <span>{photos.length} {photos.length === 1 ? "memory" : "memories"}</span>
        </div>
        {photos.length > 0 ? (
          <div className={styles.eventPhotoGrid}>
            {photos.map((photo, index) => photo.contentType?.startsWith("video/") ? (
              <video key={photo.id} src={photo.url} controls playsInline preload="metadata" aria-label={`Event video ${index + 1}`} />
            ) : (
              <img key={photo.id} src={photo.url} alt={`Event photo ${index + 1}`} loading="lazy" />
            ))}
          </div>
        ) : (
          <div className={styles.eventPhotoEmpty}><span>＋</span><strong>The gallery is ready</strong><p>Guest photos and videos will appear here as soon as they are uploaded.</p></div>
        )}
      </section>

      {qrExpanded ? (
        <div className={styles.eventQrModal} role="dialog" aria-modal="true" aria-label="Guest upload QR code" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setQrExpanded(false);
        }}>
          <div className={styles.eventQrModalCard}>
            <button className={styles.eventQrClose} type="button" onClick={() => setQrExpanded(false)} aria-label="Close enlarged QR code">×</button>
            <p className={styles.eyebrow}>Guest upload</p>
            <h3>Scan to share photos</h3>
            <img src={EVENT_QR_URL} alt="Enlarged QR code for the Event Day guest photo page" />
            <div className={styles.eventQrModalActions}>
              <a className={styles.primaryButton} href={EVENT_QR_URL} download="Erikas-Sweet-16-guest-upload-QR.svg">Download QR</a>
              <button className={styles.secondaryButton} type="button" onClick={() => setQrExpanded(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
