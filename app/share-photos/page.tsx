"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./share-photos.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string } | null;
};

function isVideo(file: File | undefined) {
  return Boolean(file?.type.startsWith("video/"));
}

function mediaLabel(files: File[]) {
  if (files.length !== 1) return `${files.length} memories`;
  return isVideo(files[0]) ? "1 video" : "1 photo";
}

export default function SharePhotosPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/event-day", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Sharing is temporarily unavailable");
        return response.json() as Promise<EventDayData>;
      })
      .then(setEventDay)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Sharing is temporarily unavailable"));
  }, []);

  useEffect(() => {
    const previews = files.map((selectedFile) => URL.createObjectURL(selectedFile));
    setFilePreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [files]);

  const uploadAllowed = Boolean(eventDay?.photoUploadsEnabled);
  const eventName = eventDay?.event?.eventName || "the celebration";

  function selectMedia(changeEvent: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(changeEvent.target.files || []);
    setFiles((currentFiles) => [...currentFiles, ...nextFiles]);
    setNotice("");
    setError("");
    changeEvent.target.value = "";
  }

  function clearPhotos() {
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function uploadPhotos(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!files.length || !uploadAllowed) return;

    setUploading(true);
    setUploadedCount(0);
    setNotice("");
    setError("");
    let completed = 0;

    try {
      for (const selectedFile of files) {
        const body = new FormData();
        body.set("photo", selectedFile);
        body.set("guestName", guestName);
        body.set("caption", caption);

        const response = await fetch("/api/photos", { method: "POST", body });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not upload that photo or video");
        completed += 1;
        setUploadedCount(completed);
      }

      clearPhotos();
      setCaption("");
      setNotice(files.length === 1
        ? `Your ${isVideo(files[0]) ? "video" : "photo"} was added. Thank you for sharing it!`
        : `All ${files.length} memories were added. Thank you for sharing them!`);
    } catch (uploadError) {
      if (completed > 0) setFiles((currentFiles) => currentFiles.slice(completed));
      const message = uploadError instanceof Error ? uploadError.message : "Could not upload that photo or video";
      setError(completed > 0
        ? `${completed} of ${files.length} memories uploaded. ${message} Please try the remaining files again.`
        : message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.monogram}>E</span>
        <div><strong>{eventName}</strong><small>Guest memory drop</small></div>
      </header>

      <section className={styles.card}>
        <div className={styles.intro}>
          <h1>Share a<br /><em>memory.</em></h1>
          <p>Share your experience for Erika.</p>
        </div>

        <form className={styles.form} onSubmit={uploadPhotos}>
          <label className={`${styles.photoPicker} ${filePreviews.length ? styles.photoSelected : ""}`}>
            {filePreviews.length ? (
              <span className={`${styles.previewGrid} ${filePreviews.length === 1 ? styles.singlePreview : ""}`}>
                {filePreviews.map((preview, index) => isVideo(files[index]) ? (
                  <span className={styles.videoPreview} key={preview}>
                    <video src={preview} muted playsInline preload="metadata" aria-label={`Selected video ${index + 1} of ${filePreviews.length}`} />
                    <i>Video</i>
                  </span>
                ) : (
                  <img key={preview} src={preview} alt={`Selected photo ${index + 1} of ${filePreviews.length}`} />
                ))}
                <strong className={styles.selectionCount}>{mediaLabel(files)} selected</strong>
              </span>
            ) : (
              <span className={styles.photoPrompt}>
                <i>＋</i>
                <strong>Choose photos or videos</strong>
                <small>Select one or more from your library</small>
              </span>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v" multiple onChange={selectMedia} disabled={!uploadAllowed || uploading} />
          </label>

          {files.length ? <button className={styles.changePhoto} type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>Add more photos or videos</button> : null}

          <label className={styles.field}>
            <span>Your name <em>optional · private</em></span>
            <input value={guestName} onChange={(event) => setGuestName(event.target.value.slice(0, 80))} maxLength={80} placeholder="Add your name if you want" autoComplete="name" disabled={!uploadAllowed} />
            <small>Your name will not appear with the photo or video.</small>
          </label>

          <label className={styles.field}>
            <span>Message <em>optional</em></span>
            <input value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 140))} maxLength={140} placeholder="Add a short note about this moment" disabled={!uploadAllowed} />
          </label>

          {eventDay && !eventDay.photoUploadsEnabled ? <p className={styles.status}>Uploads are paused by the host.</p> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {notice ? <p className={styles.success} role="status">{notice}</p> : null}

          <button className={styles.submit} type="submit" disabled={!files.length || !uploadAllowed || uploading}>
            {uploading
              ? `Uploading ${Math.min(uploadedCount + 1, files.length)} of ${files.length}…`
              : files.length > 1
                ? `Share ${files.length} memories`
                : `Share this ${isVideo(files[0]) ? "video" : "photo"}`}
          </button>
        </form>
      </section>

    </main>
  );
}
