"use client";

import { useEffect, useRef, useState } from "react";

type IntroStage = "first" | "second";

function IntroVideo({
  id,
  src,
  title,
  autoPlay = false,
  preload = "metadata",
  nextId,
  onAction,
}: {
  id: string;
  src: string;
  title: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  nextId?: string;
  onAction?: () => void;
}) {
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

  function openNext() {
    if (!nextId) return;
    onAction?.();
  }

  return (
    <section className="intro-panel" id={id}>
      <video
        className="intro-video"
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        muted
        playsInline
        preload={preload}
        aria-label={title}
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
    </section>
  );
}

export default function Home() {
  const [introStage, setIntroStage] = useState<IntroStage>("first");

  useEffect(() => {
    if (introStage !== "second") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("intro-second")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [introStage]);

  return (
    <main
      className={`intro-sequence ${introStage === "first" ? "intro-sequence--locked" : "intro-sequence--unlocked"}`}
      aria-label="After Hours invitation"
    >
      <IntroVideo
        id="intro-first"
        src="/first.mp4"
        title="After Hours invitation"
        autoPlay
        preload="auto"
        nextId="intro-second"
        onAction={() => setIntroStage("second")}
      />
      {introStage === "second" ? (
        <IntroVideo
          id="intro-second"
          src="/second.mp4"
          title="After Hours invitation transition"
          preload="metadata"
        />
      ) : null}
    </main>
  );
}
