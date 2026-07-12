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
  fullFrame = false,
  onAction,
}: {
  id: string;
  src: string;
  title: string;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto";
  nextId?: string;
  fullFrame?: boolean;
  onAction?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isVisible = false;
    const playIfVisible = () => {
      if (isVisible && video.paused) {
        video.play().catch(() => undefined);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          playIfVisible();
        } else {
          video.pause();
        }
      },
      { threshold: 0.01 },
    );

    video.addEventListener("loadeddata", playIfVisible);
    video.addEventListener("canplay", playIfVisible);
    observer.observe(video);
    return () => {
      video.removeEventListener("loadeddata", playIfVisible);
      video.removeEventListener("canplay", playIfVisible);
      observer.disconnect();
    };
  }, []);

  function openNext() {
    if (!nextId) return;
    onAction?.();
  }

  return (
    <section className={`intro-panel ${fullFrame ? "intro-panel--full" : ""}`} id={id}>
      <video
        className={`intro-video ${fullFrame ? "intro-video--full" : ""}`}
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

  return (
    <main
      className={`intro-sequence ${introStage === "first" ? "intro-sequence--locked" : "intro-sequence--unlocked"}`}
      aria-label="After Hours invitation"
    >
      {introStage === "first" ? (
        <IntroVideo
          id="intro-first"
          src="/first.mp4"
          title="After Hours invitation"
          autoPlay
          preload="auto"
          nextId="intro-second"
          onAction={() => setIntroStage("second")}
        />
      ) : (
        <IntroVideo
          id="intro-second"
          src="/second.mp4"
          title="After Hours invitation transition"
          autoPlay
          preload="auto"
          fullFrame
        />
      )}
    </main>
  );
}
