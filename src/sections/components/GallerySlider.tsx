"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Keyboard, Mousewheel } from "swiper/modules";
import "swiper/css";

import { sized, srcSet } from "@/lib/img";

export type SlidePhoto = { id: string; url: string; alt: string; caption: string; focalX: number; focalY: number; fit: "cover" | "contain"; width?: number | null; version?: string | null };

/** Horizontal photo row: swipe, drag, trackpad or arrow keys. */
export default function GallerySlider({ photos, captions }: { photos: SlidePhoto[]; captions: boolean }) {
  return (
    <Swiper
      modules={[FreeMode, Mousewheel, Keyboard]}
      freeMode
      grabCursor
      speed={500}
      spaceBetween={10}
      slidesPerView={1.15}
      keyboard={{ enabled: true, onlyInViewport: true }}
      mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
      breakpoints={{ 700: { slidesPerView: 2.2, spaceBetween: 16 }, 1100: { slidesPerView: 3, spaceBetween: 18 } }}
    >
      {photos.map((p) => (
        <SwiperSlide key={p.id}>
          <figure>
            <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
              <img src={sized(p.url, 960, p.version)} srcSet={srcSet(p.url, p.width, p.version)} sizes="(min-width: 1100px) 33vw, (min-width: 700px) 45vw, 87vw" alt={p.alt} loading="lazy" className="absolute inset-0 size-full" style={{ objectFit: p.fit, objectPosition: `${p.focalX}% ${p.focalY}%` }} />
            </div>
            {captions && p.caption && <figcaption className="mt-2 text-2xs text-muted">{p.caption}</figcaption>}
          </figure>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
