"use client";

import { useEffect, useRef, useState } from "react";
import { sharePreview } from "@/app/admin/(panel)/content/preview-actions";
import { btn, inputCls } from "./ui";

const DEVICES = [
  { key: "desktop", label: "Desktop", width: 1440 },
  { key: "tablet", label: "Tablet", width: 820 },
  { key: "phone", label: "Phone", width: 390 },
] as const;

/** The page as visitors will see it, inside the admin, at desktop, tablet or phone width. */
export function PreviewFrame({ src, device, height = 900 }: { src: string; device: (typeof DEVICES)[number]["key"]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const width = DEVICES.find((d) => d.key === device)!.width;
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="w-full overflow-hidden bg-paper-2" style={{ height: height * scale }}>
      <iframe
        title="Page preview"
        src={src}
        className="origin-top-left border-0 bg-paper"
        style={{ width, height, transform: `scale(${scale})`, marginLeft: scale === 1 ? `calc((100% - ${width}px) / 2)` : 0 }}
      />
    </div>
  );
}

export default function PreviewModal({ previewId, onClose, title = "Preview" }: { previewId: string; onClose: () => void; title?: string }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [share, setShare] = useState<{ url?: string; expiresAt?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const src = `/preview/${previewId}/?frame=1`;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/50 p-2 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex min-h-0 flex-1 flex-col bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="mono text-title">{title}</h2>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Screen size">
            {DEVICES.map((d) => (
              <button key={d.key} type="button" aria-pressed={device === d.key} onClick={() => setDevice(d.key)} className="h-8 border border-line px-3 text-2xs aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper">
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/preview/${previewId}/`} target="_blank" className={btn.ghost}>
              Open in new tab ↗
            </a>
            <button type="button" className={btn.secondary} onClick={async () => setShare(await sharePreview(previewId))}>
              Share link
            </button>
            <button type="button" className={btn.ghost} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {share && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-2/60 px-4 py-2 text-2xs">
            {share.error ? (
              <span className="text-brand">{share.error}</span>
            ) : (
              <>
                <span>Anyone with this link can see this preview until {new Date(share.expiresAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}:</span>
                <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} h-8 min-w-0 flex-1 font-mono text-2xs`} aria-label="Share link" />
                <button type="button" className={btn.secondary} onClick={() => copy(share.url!)}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
          <div className={device === "desktop" ? "" : "mx-auto"} style={{ maxWidth: DEVICES.find((d) => d.key === device)!.width }}>
            <PreviewFrame src={src} device={device} height={2400} />
          </div>
        </div>
      </div>
    </div>
  );
}
