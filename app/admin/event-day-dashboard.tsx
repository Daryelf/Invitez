"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string; eventDate: string; eventTime: string; venue: string } | null;
};

type GalleryPhoto = {
  id: string;
  name: string;
  url: string;
  downloadUrl: string;
  contentType: string;
  caption: string;
  guestName: string;
  createdAt: string;
};

type GuestMediaGroup = {
  key: string;
  guestName: string;
  photos: GalleryPhoto[];
  latestAt: string;
};

const EVENT_DAY_URL = "https://www.invitez.xyz/share-photos";
const EVENT_QR_URL = "/event-upload-qr.svg";

function isVideo(photo: GalleryPhoto) {
  return photo.contentType?.startsWith("video/");
}

function mediaPreview(photo: GalleryPhoto, label: string, controls = false) {
  return isVideo(photo) ? (
    <video src={photo.url} controls={controls} muted={!controls} playsInline preload="metadata" aria-label={label} />
  ) : (
    <img src={photo.url} alt={label} loading="lazy" />
  );
}

function friendlyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Shared at the event";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default function EventDayDashboard() {
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy guest link");
  const [qrExpanded, setQrExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState("");
  const [galleryError, setGalleryError] = useState("");

  const load = useCallback(async () => {
    try {
      const [eventResponse, photoResponse] = await Promise.all([
        fetch("/api/event-day", { cache: "no-store" }),
        fetch("/api/admin/photos", { cache: "no-store" }),
      ]);
      if (eventResponse.ok) setEventDay(await eventResponse.json() as EventDayData);
      if (photoResponse.ok) {
        const result = await photoResponse.json() as { photos?: GalleryPhoto[] };
        setPhotos(result.photos ?? []);
        setGalleryError("");
      } else {
        const result = await photoResponse.json().catch(() => ({})) as { error?: string };
        setGalleryError(result.error || "Could not load the private guest gallery.");
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

  const guestGroups = useMemo(() => {
    const groups = new Map<string, GuestMediaGroup>();
    for (const photo of photos) {
      const normalizedName = photo.guestName.trim().toLocaleLowerCase();
      const key = normalizedName || "__anonymous__";
      const existing = groups.get(key);
      if (existing) {
        existing.photos.push(photo);
        existing.latestAt = photo.createdAt;
      } else {
        groups.set(key, {
          key,
          guestName: photo.guestName.trim() || "Anonymous uploads",
          photos: [photo],
          latestAt: photo.createdAt,
        });
      }
    }
    return [...groups.values()].sort((left, right) => right.latestAt.localeCompare(left.latestAt));
  }, [photos]);

  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return guestGroups;
    return guestGroups.filter((group) => group.guestName.toLocaleLowerCase().includes(query)
      || group.photos.some((photo) => photo.caption.toLocaleLowerCase().includes(query) || photo.name.toLocaleLowerCase().includes(query)));
  }, [guestGroups, searchQuery]);

  const everyVisibleGroupIsOpen = visibleGroups.length > 0 && visibleGroups.every((group) => expandedGroups.has(group.key));

  function toggleGroup(key: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllGroups() {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (everyVisibleGroupIsOpen) visibleGroups.forEach((group) => next.delete(group.key));
      else visibleGroups.forEach((group) => next.add(group.key));
      return next;
    });
  }

  async function deletePhoto(photo: GalleryPhoto) {
    const confirmed = window.confirm(`Delete ${photo.name}? This permanently removes it from the gallery.`);
    if (!confirmed) return;
    setDeletingId(photo.id);
    setGalleryError("");
    try {
      const response = await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete that memory.");
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (error) {
      setGalleryError(error instanceof Error ? error.message : "Could not delete that memory.");
    } finally {
      setDeletingId("");
    }
  }

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
          <div><p className={styles.eyebrow}>Private guest gallery</p><h3>Shared memories</h3></div>
          <span>{photos.length} {photos.length === 1 ? "memory" : "memories"} · {guestGroups.length} {guestGroups.length === 1 ? "guest" : "guests"}</span>
        </div>

        <div className={styles.eventGalleryToolbar}>
          <label>
            <span>Search memories</span>
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search guest names or messages" />
          </label>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={toggleAllGroups} disabled={!visibleGroups.length}>{everyVisibleGroupIsOpen ? "Collapse all" : "Expand all"}</button>
            {photos.length ? <a className={styles.primaryButton} href="/api/admin/photos/download" download="Erikas-Sweet-16-guest-memories.zip">Download all</a> : null}
          </div>
        </div>

        {galleryError ? <p className={styles.galleryError} role="alert">{galleryError}</p> : null}

        {visibleGroups.length > 0 ? (
          <div className={styles.guestMediaGroups}>
            {visibleGroups.map((group) => {
              const expanded = expandedGroups.has(group.key);
              const cover = group.photos[0];
              const firstComment = group.photos.find((photo) => photo.caption)?.caption || "No message added.";
              return (
                <article className={styles.guestMediaCard} key={group.key}>
                  <button className={styles.guestMediaCover} type="button" onClick={() => toggleGroup(group.key)} aria-expanded={expanded}>
                    {mediaPreview(cover, `First memory shared by ${group.guestName}`)}
                    <span>{group.photos.length} {group.photos.length === 1 ? "memory" : "memories"}</span>
                  </button>
                  <div className={styles.guestMediaSummary}>
                    <p className={styles.eyebrow}>Shared by</p>
                    <h4>{group.guestName}</h4>
                    <p>{firstComment}</p>
                    <button type="button" onClick={() => toggleGroup(group.key)}>{expanded ? "Collapse media" : group.photos.length === 1 ? "Open media" : `View all ${group.photos.length}`}</button>
                  </div>

                  {expanded ? (
                    <div className={styles.guestMediaItems}>
                      {group.photos.map((photo, index) => (
                        <figure key={photo.id}>
                          {mediaPreview(photo, `${isVideo(photo) ? "Video" : "Photo"} ${index + 1} shared by ${group.guestName}`, true)}
                          <figcaption>
                            <p>{photo.caption || "No message added."}</p>
                            <time dateTime={photo.createdAt}>{friendlyDate(photo.createdAt)}</time>
                            <div>
                              <a href={photo.downloadUrl} download={photo.name}>Download</a>
                              <button type="button" onClick={() => void deletePhoto(photo)} disabled={deletingId === photo.id}>{deletingId === photo.id ? "Deleting…" : "Delete"}</button>
                            </div>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : photos.length > 0 ? (
          <div className={styles.eventPhotoEmpty}><span>⌕</span><strong>No memories found</strong><p>Try another guest name, message, or filename.</p></div>
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
