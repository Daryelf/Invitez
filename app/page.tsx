"use client";

import { useEffect, useRef } from "react";

function IntroVideo({ id, src, title }: { id: string; src: string; title: string }) {
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
      />
    </section>
  );
}

export default function Home() {
  return (
    <main className="site-shell" aria-label="After Hours invitation videos">
      <section className="intro-sequence">
        <IntroVideo id="intro-first" src="/first.mp4" title="After Hours invitation" />
        <IntroVideo id="intro-second" src="/second.mp4" title="After Hours event details" />
      </section>
    </main>
  );
}
