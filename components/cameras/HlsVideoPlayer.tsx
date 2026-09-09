"use client";

import { useEffect, useRef } from "react";

export default function HlsVideoPlayer({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    void import("hls.js").then((mod) => {
      if (cancelled) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) return;
      const instance = new Hls({ enableWorker: false });
      hls = instance;
      if (cancelled) {
        instance.destroy();
        return;
      }
      instance.loadSource(src);
      instance.attachMedia(video);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      muted
      autoPlay
      title={title}
      className="aspect-video w-full rounded-xl bg-black"
    />
  );
}