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
  const [isComplete, setIsComplete] = useState(false);

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
    if (!nextId || !isComplete) return;
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
        onEnded={() => setIsComplete(true)}
      />
      {nextId ? (
        <button
          type="button"
          className="intro-action"
          aria-label="Open invitation"
          disabled={!isComplete}
          onClick={openNext}
        />
      ) : null}
    </section>
  );
}

export default function Home() {
  const [introStage, setIntroStage] = useState<IntroStage>("first");

  return (
    <main className="intro-sequence" aria-label="After Hours invitation">
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
