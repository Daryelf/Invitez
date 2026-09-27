"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./share-photos.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string } | null;
};

const MAX_BATCH_FILES = 10;
type Language = "en" | "es";

const copy = {
  en: {
    guestDrop: "Guest memory drop",
    shareTitle: "Share a",
    memory: "memory.",
    experience: "Share your experience for Erika.",
    choose: "Choose photos or videos",
    limit: `Upload up to ${MAX_BATCH_FILES} photos or videos at a time`,
    addMore: "Add more photos or videos",
    yourName: "Your name",
    optionalPrivate: "optional · private",
    namePlaceholder: "Add your name if you want",
    namePrivacy: "Your name will not appear with the photo or video.",
    message: "Message",
    optional: "optional",
    messagePlaceholder: "Add a short note about this moment",
    paused: "Uploads are paused by the host.",
    unavailable: "Sharing is temporarily unavailable",
    uploadError: "Could not upload that photo or video",
    submitted: "Submitted",
    thanks: "Thank you for celebrating Erika!",
    submitMore: "Submit new photos or videos",
    photo: "photo",
    photos: "photos",
    video: "video",
    videos: "videos",
    memories: "memories",
    selected: "selected",
    share: "Share",
    shareThis: "Share this",
    uploading: "Uploading",
    in: "in.",
    wasShared: "was shared successfully.",
    wereShared: "were shared successfully.",
    remaining: "Please try the remaining files again.",
    batchLimit: `You can upload up to ${MAX_BATCH_FILES} photos or videos at a time.`,
    changeLanguage: "Language",
  },
  es: {
    guestDrop: "Recuerdos de los invitados",
    shareTitle: "Comparte un",
    memory: "recuerdo.",
    experience: "Comparte tu experiencia para Erika.",
    choose: "Elige fotos o videos",
    limit: `Sube hasta ${MAX_BATCH_FILES} fotos o videos a la vez`,
    addMore: "Agregar más fotos o videos",
    yourName: "Tu nombre",
    optionalPrivate: "opcional · privado",
    namePlaceholder: "Agrega tu nombre si quieres",
    namePrivacy: "Tu nombre no aparecerá con la foto o el video.",
    message: "Mensaje",
    optional: "opcional",
    messagePlaceholder: "Agrega una nota corta sobre este momento",
    paused: "El anfitrión ha pausado las cargas.",
    unavailable: "La página para compartir no está disponible por el momento",
    uploadError: "No se pudo subir esa foto o video",
    submitted: "Enviado",
    thanks: "¡Gracias por celebrar con Erika!",
    submitMore: "Subir más fotos o videos",
    photo: "foto",
    photos: "fotos",
    video: "video",
    videos: "videos",
    memories: "recuerdos",
    selected: "seleccionado",
    share: "Compartir",
    shareThis: "Compartir este",
    uploading: "Subiendo",
    in: "enviado.",
    wasShared: "se compartió correctamente.",
    wereShared: "se compartieron correctamente.",
    remaining: "Intenta subir los archivos restantes de nuevo.",
    batchLimit: `Puedes subir hasta ${MAX_BATCH_FILES} fotos o videos a la vez.`,
    changeLanguage: "Idioma",
  },
} as const;

function isVideo(file: File | undefined) {
  return Boolean(file?.type.startsWith("video/"));
}

function mediaLabel(files: File[], language: Language) {
  const text = copy[language];
  if (language === "es") {
    if (files.length !== 1) return `${files.length} archivos seleccionados`;
    return isVideo(files[0]) ? "1 video seleccionado" : "1 foto seleccionada";
  }
  if (files.length !== 1) return `${files.length} ${text.memories} selected`;
  return isVideo(files[0]) ? "1 video selected" : "1 photo selected";
}

export default function SharePhotosPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [eventDay, setEventDay] = useState<EventDayData | null>(null);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const previewUrls = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [submitted, setSubmitted] = useState<{ count: number; singleWasVideo: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!language) return;
    fetch("/api/event-day", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(copy[language].unavailable);
        return response.json() as Promise<EventDayData>;
      })
      .then(setEventDay)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : copy[language].unavailable));
  }, [language]);

  useEffect(() => {
    return () => previewUrls.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  const uploadAllowed = Boolean(eventDay?.photoUploadsEnabled);
  const eventName = eventDay?.event?.eventName || (language === "es" ? "la celebración" : "the celebration");
  const text = copy[language || "en"];

  useEffect(() => {
    document.documentElement.lang = language || "en";
  }, [language]);

  function selectMedia(changeEvent: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(changeEvent.target.files || []);
    const availableSlots = Math.max(0, MAX_BATCH_FILES - files.length);
    const acceptedFiles = nextFiles.slice(0, availableSlots);
    previewUrls.current.push(...acceptedFiles.map((file) => URL.createObjectURL(file)));
    setFiles([...files, ...acceptedFiles]);
    setFilePreviews([...previewUrls.current]);
    setError(nextFiles.length > availableSlots ? text.batchLimit : "");
    changeEvent.target.value = "";
  }

  function clearPhotos() {
    previewUrls.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewUrls.current = [];
    setFiles([]);
    setFilePreviews([]);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function uploadPhotos(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!files.length || !uploadAllowed) return;

    setUploading(true);
    setUploadedCount(0);
    setError("");
    let completed = 0;
    const batchSize = files.length;
    const singleWasVideo = batchSize === 1 && isVideo(files[0]);

    try {
      for (const selectedFile of files) {
        const response = await fetch("/api/photos", {
          method: "POST",
          headers: {
            "Content-Type": selectedFile.type,
            "X-File-Name": encodeURIComponent(selectedFile.name),
            "X-Guest-Name": encodeURIComponent(guestName),
            "X-Caption": encodeURIComponent(caption),
          },
          body: selectedFile,
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(language === "es" ? text.uploadError : (result.error || text.uploadError));
        completed += 1;
        setUploadedCount(completed);
      }

      clearPhotos();
      setCaption("");
      setSubmitted({ count: batchSize, singleWasVideo });
    } catch (uploadError) {
      if (completed > 0) {
        previewUrls.current.splice(0, completed).forEach((preview) => URL.revokeObjectURL(preview));
        setFiles(files.slice(completed));
        setFilePreviews([...previewUrls.current]);
      }
      const message = uploadError instanceof Error ? uploadError.message : text.uploadError;
      setError(completed > 0
        ? language === "es"
          ? `${completed} de ${files.length} recuerdos subidos. ${message} ${text.remaining}`
          : `${completed} of ${files.length} memories uploaded. ${message} ${text.remaining}`
        : message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      {!language ? (
        <section className={styles.languageGate} aria-labelledby="language-title">
          <span className={styles.languageMonogram}>E</span>
          <p>Welcome · Bienvenidos</p>
          <h1 id="language-title">Choose your language<br /><em>Elige tu idioma</em></h1>
          <div className={styles.languageChoices}>
            <button type="button" onClick={() => setLanguage("en")}><strong>English</strong><span>Continue in English</span></button>
            <button type="button" lang="es" onClick={() => setLanguage("es")}><strong>Español</strong><span>Continuar en español</span></button>
          </div>
        </section>
      ) : <>
      <header className={styles.header}>
        <span className={styles.monogram}>E</span>
        <div><strong>{eventName}</strong><small>{text.guestDrop}</small></div>
        <button className={styles.languageSwitch} type="button" onClick={() => setLanguage(null)} aria-label={text.changeLanguage}>{language === "en" ? "ES" : "EN"}</button>
      </header>

      <section className={styles.card}>
        {submitted ? (
          <div className={styles.confirmation} role="status" aria-live="polite">
            <span className={styles.confirmationIcon} aria-hidden="true">✓</span>
            <small>{text.submitted}</small>
            <h1>{language === "es"
              ? submitted.count === 1 ? (submitted.singleWasVideo ? "Tu video fue enviado." : "Tu foto fue enviada.") : `Tus ${text.memories} fueron enviados.`
              : `Your ${submitted.count === 1 ? (submitted.singleWasVideo ? "video is" : "photo is") : "memories are"} in.`}</h1>
            <p>{language === "es"
              ? submitted.count === 1
                ? `Tu ${submitted.singleWasVideo ? text.video : text.photo} ${text.wasShared} ${text.thanks}`
                : `Las ${submitted.count} fotos y videos ${text.wereShared} ${text.thanks}`
              : submitted.count === 1
                ? `Your ${submitted.singleWasVideo ? text.video : text.photo} ${text.wasShared} ${text.thanks}`
                : `All ${submitted.count} photos and videos ${text.wereShared} ${text.thanks}`}</p>
            <button type="button" onClick={() => setSubmitted(null)}>{text.submitMore}</button>
          </div>
        ) : <>
          <div className={styles.intro}>
            <h1>{text.shareTitle}<br /><em>{text.memory}</em></h1>
            <p>{text.experience}</p>
          </div>

          <form className={styles.form} onSubmit={uploadPhotos}>
          <label className={`${styles.photoPicker} ${filePreviews.length ? styles.photoSelected : ""}`}>
            {filePreviews.length ? (
              <span className={`${styles.previewGrid} ${filePreviews.length === 1 ? styles.singlePreview : ""}`}>
                {filePreviews.map((preview, index) => isVideo(files[index]) ? (
                  <span className={styles.videoPreview} key={preview}>
                    <video src={preview} muted playsInline preload="metadata" aria-label={`${text.video} ${index + 1} / ${filePreviews.length}`} />
                    <i>{text.video}</i>
                  </span>
                ) : (
                  <img key={preview} src={preview} alt={`${text.photo} ${index + 1} / ${filePreviews.length}`} />
                ))}
                <strong className={styles.selectionCount}>{mediaLabel(files, language)}</strong>
              </span>
            ) : (
              <span className={styles.photoPrompt}>
                <i>＋</i>
                <strong>{text.choose}</strong>
                <small>{text.limit}</small>
              </span>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v" multiple onChange={selectMedia} disabled={!uploadAllowed || uploading} />
          </label>

          {files.length ? <button className={styles.changePhoto} type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>{text.addMore}</button> : null}

          <label className={styles.field}>
            <span>{text.yourName} <em>{text.optionalPrivate}</em></span>
            <input value={guestName} onChange={(event) => setGuestName(event.target.value.slice(0, 80))} maxLength={80} placeholder={text.namePlaceholder} autoComplete="name" disabled={!uploadAllowed} />
            <small>{text.namePrivacy}</small>
          </label>

          <label className={styles.field}>
            <span>{text.message} <em>{text.optional}</em></span>
            <input value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 140))} maxLength={140} placeholder={text.messagePlaceholder} disabled={!uploadAllowed} />
          </label>

          {eventDay && !eventDay.photoUploadsEnabled ? <p className={styles.status}>{text.paused}</p> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}

          <button className={styles.submit} type="submit" disabled={!files.length || !uploadAllowed || uploading}>
            {uploading
              ? `${text.uploading} ${Math.min(uploadedCount + 1, files.length)} / ${files.length}…`
              : files.length > 1
                ? `${text.share} ${files.length} ${text.memories}`
                : language === "es"
                  ? `Compartir ${isVideo(files[0]) ? "este video" : "esta foto"}`
                  : `${text.shareThis} ${isVideo(files[0]) ? text.video : text.photo}`}
          </button>
          </form>
        </>}
      </section>
      </>}
    </main>
  );
}
