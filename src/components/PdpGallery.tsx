"use client";

import type { ReactNode } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";
import "swiper/css";

/**
 * Product gallery that runs off the right edge: drag (hand cursor), horizontal trackpad/mouse
 * scroll or arrow keys; endless loop. Vertical wheel still scrolls the page.
 */
export default function PdpGallery({ slides, label }: { slides: ReactNode[]; label: string }) {
  // Looping with "auto" widths needs enough slides to fill the track, so repeat short galleries.
  const looped = slides.length < 6 ? [...slides, ...slides] : slides;

  return (
    <div className="h-full min-w-0" aria-roledescription="carousel" aria-label={label}>
      <Swiper
        modules={[Mousewheel, Keyboard]}
        className="h-full"
        slidesPerView="auto"
        spaceBetween={10}
        speed={300}
        loop
        keyboard={{ enabled: true }}
        mousewheel={{ forceToAxis: true, sensitivity: 1 }}
        grabCursor
      >
        {looped.map((s, i) => (
          <SwiperSlide key={i} className="!h-full !w-auto aspect-[588/747]">
            <div className="relative h-full overflow-hidden bg-paper-2">{s}</div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
