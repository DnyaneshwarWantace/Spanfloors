"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Keyboard, Mousewheel } from "swiper/modules";
import "swiper/css";
import ProductCard, { type CardProduct } from "./ProductCard";

/** Horizontal product row, 4 across on desktop (5:6 cards). Swipe/drag, trackpad horizontal scroll or arrow keys. */
export default function CardsSlider({ products }: { products: CardProduct[] }) {
  return (
    <div className="px-gap">
      <Swiper
        modules={[FreeMode, Mousewheel, Keyboard]}
        freeMode
        grabCursor
        speed={500}
        spaceBetween={10}
        slidesPerView={1.25}
        keyboard={{ enabled: true, onlyInViewport: true }}
        mousewheel={{ forceToAxis: true, sensitivity: 0.8, releaseOnEdges: true }}
        breakpoints={{ 600: { slidesPerView: 2.2, spaceBetween: 18 }, 1000: { slidesPerView: 4, spaceBetween: 18 } }}
      >
        {products.map((p) => (
          <SwiperSlide key={p.id}>
            <ProductCard p={p} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
