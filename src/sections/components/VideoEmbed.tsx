"use client";

import { useState } from "react";
import { parseVideo } from "../video";

/** Shows the video's thumbnail and loads the player only when clicked (keeps pages fast). */
export default function VideoEmbed({ url, title, poster }: { url: string; title: string; poster?: string | null }) {
  const v = parseVideo(url);
  const [play, setPlay] = useState(false);
  if (!v) return null;
  const thumb = poster ?? v.thumbnail;
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-ink">
      {play ? (
        <iframe
          src={`${v.embed}${v.embed.includes("?") ? "&" : "?"}autoplay=1&rel=0`}
          title={title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 size-full" aria-label={`Play video${title ? `: ${title}` : ""}`}>
          {thumb && <img src={thumb} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />}
          <span className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
