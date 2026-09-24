"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./share-photos.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string } | null;
};

export default function SharePhotosPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/event-day", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Photo sharing is temporarily unavailable");
        return response.json() as Promise<EventDayData>;
      })
      .then(setEventDay)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Photo sharing is temporarily unavailable"));
  }, []);

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const uploadAllowed = Boolean(eventDay?.photoUploadsEnabled);
  const eventName = eventDay?.event?.eventName || "the celebration";

  function selectPhoto(changeEvent: ChangeEvent<HTMLInputElement>) {
    const nextFile = changeEvent.target.files?.[0] || null;
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(nextFile);
    setFilePreview(nextFile ? URL.createObjectURL(nextFile) : "");
    setNotice("");
    setError("");
  }

  function clearPhoto() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function uploadPhoto(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!file || !uploadAllowed) return;

    setUploading(true);
    setNotice("");
    setError("");
    const body = new FormData();
    body.set("photo", file);
    body.set("guestName", guestName);
    body.set("caption", caption);

    try {
      const response = await fetch("/api/photos", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not upload that photo");
      clearPhoto();
      setCaption("");
      setNotice("Your photo was added. Thank you for sharing it!");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload that photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.monogram}>E</span>
        <div><strong>{eventName}</strong><small>Guest photo drop</small></div>
      </header>

      <section className={styles.card}>
        <div className={styles.intro}>
          <h1>Share a<br /><em>memory.</em></h1>
          <p>Share your experience for Erika.</p>
        </div>

        <form className={styles.form} onSubmit={uploadPhoto}>
          <label className={`${styles.photoPicker} ${filePreview ? styles.photoSelected : ""}`}>
            {filePreview ? (
              <img src={filePreview} alt="Your selected photo" />
            ) : (
              <span className={styles.photoPrompt}>
                <i>＋</i>
                <strong>Choose a photo</strong>
                <small>Open your camera or photo library</small>
              </span>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} disabled={!uploadAllowed} />
          </label>

          {file ? <button className={styles.changePhoto} type="button" onClick={clearPhoto}>Choose a different photo</button> : null}

          <label className={styles.field}>
            <span>Your name <em>optional · private</em></span>
            <input value={guestName} onChange={(event) => setGuestName(event.target.value.slice(0, 80))} maxLength={80} placeholder="Add your name if you want" autoComplete="name" disabled={!uploadAllowed} />
            <small>Your name will not appear with the photo.</small>
          </label>

          <label className={styles.field}>
            <span>Message <em>optional</em></span>
            <input value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 140))} maxLength={140} placeholder="Add a short note about this moment" disabled={!uploadAllowed} />
          </label>

          {eventDay && !eventDay.photoUploadsEnabled ? <p className={styles.status}>Photo uploads are paused by the host.</p> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {notice ? <p className={styles.success} role="status">{notice}</p> : null}

          <button className={styles.submit} type="submit" disabled={!file || !uploadAllowed || uploading}>
            {uploading ? "Uploading…" : notice ? "Add another photo" : "Share this photo"}
          </button>
        </form>
      </section>

    </main>
  );
}
