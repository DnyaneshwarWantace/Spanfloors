"use client";

import { useEffect, useRef, type ElementType, type ReactNode, type CSSProperties } from "react";

/** Adds `is-in` once the element scrolls into view, which starts the CSS reveal animation. */
export default function Reveal({
  as: Tag = "div",
  zoom = false,
  delay,
  className = "",
  style,
  children,
}: {
  as?: ElementType;
  zoom?: boolean;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`${zoom ? "reveal-zoom" : "reveal"} ${className}`}
      style={{ ...style, ...(delay != null ? { ["--delay" as string]: `${delay}s` } : {}) }}
    >
      {children}
    </Tag>
  );
}
