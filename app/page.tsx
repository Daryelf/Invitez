"use client";

import { useEffect, useRef, useState } from "react";

function IntroVideo({
  id,
  src,
  title,
  nextId,
}: {
  id: string;
  src: string;
  title: string;
  nextId?: string;
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

  function openInvitation() {
    if (!nextId) return;
    document.getElementById(nextId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="intro-panel" id={id}>
      <video
        className="intro-video"
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-label={title}
        onEnded={() => setIsComplete(true)}
      />
      {nextId ? (
        <button
          type="button"
          className="intro-action"
          aria-label="Open invitation"
          disabled={!isComplete}
          onClick={openInvitation}
        />
      ) : null}
    </section>
  );
}

export default function Home() {
  return (
    <main className="site-shell" aria-label="After Hours invitation videos">
      <section className="intro-sequence">
        <IntroVideo
          id="intro-first"
          src="/first.mp4"
          title="After Hours invitation"
          nextId="intro-second"
        />
        <IntroVideo id="intro-second" src="/second.mp4" title="After Hours event details" />
      </section>
    </main>
  );
}
