"use client";

import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./share-photos.module.css";

type EventDayData = {
  active: boolean;
  photoUploadsEnabled: boolean;
  event: { eventName: string } | null;
};

const MAX_BATCH_FILES = 25;
const MAX_IMAGE_SIZE = 32 * 1024 * 1024;
const MAX_VIDEO_SIZE = 90 * 1024 * 1024;
const TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", avif: "image/avif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v",
};
const SUPPORTED_TYPES = new Set(Object.values(TYPES_BY_EXTENSION));
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
    moreQuestion: "Have more memories to share?",
    submitMore: "Upload more photos or videos",
    adventraCredit: "Erika’s entire digital celebration—from invitations and RSVP to sharing photos and videos—was created by Adventra.",
    adventraLink: "Explore Adventra services",
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
    retry: "Retry connection",
    connection: "Could not check uploads. Tap Retry connection.",
    unsupported: "Choose a JPG, PNG, WebP, HEIC, HEIF, AVIF, MP4, MOV, WebM, or M4V file.",
    photoTooLarge: "Photos must be under 32 MB.",
    videoTooLarge: "Videos must be under 90 MB.",
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
    moreQuestion: "¿Tienes más recuerdos para compartir?",
    submitMore: "Subir más fotos o videos",
    adventraCredit: "Adventra creó toda la experiencia digital de la celebración de Erika: desde las invitaciones y las confirmaciones de asistencia hasta compartir fotos y videos.",
    adventraLink: "Explora los servicios de Adventra",
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
    retry: "Reintentar conexión",
    connection: "No se pudo comprobar si se pueden subir archivos. Toca Reintentar conexión.",
    unsupported: "Elige un archivo JPG, PNG, WebP, HEIC, HEIF, AVIF, MP4, MOV, WebM o M4V.",
    photoTooLarge: "Las fotos deben pesar menos de 32 MB.",
    videoTooLarge: "Los videos deben pesar menos de 90 MB.",
  },
} as const;

function mediaType(file: File) {
  const type = (file.type || "").toLowerCase();
  if (SUPPORTED_TYPES.has(type)) return type;
  return TYPES_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() || ""] || type;
}

function isVideo(file: File | undefined) {
  return Boolean(file && mediaType(file).startsWith("video/"));
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
  const [settingsError, setSettingsError] = useState(false);
  const [settingsAttempt, setSettingsAttempt] = useState(0);

  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    fetch("/api/event-day", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(copy[language].unavailable);
        return response.json() as Promise<EventDayData>;
      })
      .then((data) => { if (!cancelled) setEventDay(data); })
      .catch(() => { if (!cancelled) setSettingsError(true); });
    return () => { cancelled = true; };
  }, [language, settingsAttempt]);

  useEffect(() => {
    return () => previewUrls.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  const uploadAllowed = Boolean(eventDay?.photoUploadsEnabled);
  const pickerAllowed = eventDay?.photoUploadsEnabled !== false && !uploading;
  const eventName = eventDay?.event?.eventName || (language === "es" ? "la celebración" : "the celebration");
  const text = copy[language || "en"];

  function chooseLanguage(nextLanguage: Language) {
    setEventDay(null);
    setSettingsError(false);
    setLanguage(nextLanguage);
  }

  function retryConnection() {
    setEventDay(null);
    setSettingsError(false);
    setSettingsAttempt((attempt) => attempt + 1);
  }

  useEffect(() => {
    document.documentElement.lang = language || "en";
  }, [language]);

  function selectMedia(changeEvent: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(changeEvent.target.files || []);
    const availableSlots = Math.max(0, MAX_BATCH_FILES - files.length);
    let invalidMessage = "";
    const validFiles = nextFiles.filter((file) => {
      const type = mediaType(file);
      if (!SUPPORTED_TYPES.has(type)) {
        invalidMessage = text.unsupported;
        return false;
      }
      if (file.size > (isVideo(file) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)) {
        invalidMessage = isVideo(file) ? text.videoTooLarge : text.photoTooLarge;
        return false;
      }
      return true;
    });
    const acceptedFiles = validFiles.slice(0, availableSlots);
    previewUrls.current.push(...acceptedFiles.map((file) => URL.createObjectURL(file)));
    setFiles([...files, ...acceptedFiles]);
    setFilePreviews([...previewUrls.current]);
    setError(invalidMessage || (validFiles.length > availableSlots ? text.batchLimit : ""));
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
            "Content-Type": mediaType(selectedFile),
            "X-File-Name": encodeURIComponent(selectedFile.name),
            "X-Guest-Name": encodeURIComponent(guestName),
            "X-Caption": encodeURIComponent(caption),
          },
          body: selectedFile,
        });
        const result = await response.json().catch(() => ({})) as { error?: string };
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
          <p>Welcome · Bienvenidos</p>
          <h1 id="language-title">Choose your language<br /><em>Elige tu idioma</em></h1>
          <div className={styles.languageChoices}>
            <button type="button" onClick={() => chooseLanguage("en")}><strong>English</strong><span>Continue in English</span></button>
            <button type="button" lang="es" onClick={() => chooseLanguage("es")}><strong>Español</strong><span>Continuar en español</span></button>
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
            <div className={styles.moreMemories}>
              <strong>{text.moreQuestion}</strong>
              <button type="button" onClick={() => setSubmitted(null)}>{text.submitMore}</button>
            </div>
            <div className={styles.adventraCredit}>
              <div className={styles.adventraBrand}>
                <div className={styles.adventraLogoCrop}>
                  <img src="/adventra-official-transparent.png" alt="Adventra" width="1254" height="1254" />
                </div>
                <strong>DIGITAL GROWTH STUDIO</strong>
              </div>
              <p>{text.adventraCredit}</p>
              <a href="https://adventra.us/" target="_blank" rel="noopener noreferrer">{text.adventraLink} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        ) : <>
          <div className={styles.intro}>
            <h1>{text.shareTitle}<br /><em>{text.memory}</em></h1>
            <p>{text.experience}</p>
          </div>

          <form className={styles.form} onSubmit={uploadPhotos}>
          {settingsError ? <div className={styles.retryPanel} role="alert"><span>{text.connection}</span><button type="button" onClick={retryConnection}>{text.retry}</button></div> : null}
          <label className={`${styles.photoPicker} ${filePreviews.length ? styles.photoSelected : ""}`}>
            {filePreviews.length ? (
              <span className={`${styles.previewGrid} ${filePreviews.length === 1 ? styles.singlePreview : ""}`}>
                {filePreviews.slice(0, 4).map((preview, index) => (mediaType(files[index]) === "image/heic" || mediaType(files[index]) === "image/heif") ? (
                  <span className={styles.filePreviewFallback} key={preview}>{files[index].name}</span>
                ) : isVideo(files[index]) ? (
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
            <input id="guest-media" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-m4v,.mov" multiple onChange={selectMedia} disabled={!pickerAllowed} />
          </label>

          {files.length ? <label className={styles.changePhoto} htmlFor="guest-media" role="button" tabIndex={uploading ? -1 : 0} aria-disabled={uploading} onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !uploading) { event.preventDefault(); fileInput.current?.click(); }
          }}>{text.addMore}</label> : null}

          <label className={styles.field}>
            <span>{text.yourName} <em>{text.optionalPrivate}</em></span>
            <input value={guestName} onChange={(event) => setGuestName(event.target.value.slice(0, 80))} maxLength={80} placeholder={text.namePlaceholder} autoComplete="name" disabled={eventDay?.photoUploadsEnabled === false || uploading} />
            <small>{text.namePrivacy}</small>
          </label>

          <label className={styles.field}>
            <span>{text.message} <em>{text.optional}</em></span>
            <input value={caption} onChange={(event) => setCaption(event.target.value.slice(0, 140))} maxLength={140} placeholder={text.messagePlaceholder} disabled={eventDay?.photoUploadsEnabled === false || uploading} />
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
