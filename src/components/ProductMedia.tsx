import { TONE_COLORS } from "@/lib/labels";

/**
 * Product image, or a placeholder (wood tone + Span Floors logo) until the real
 * image is available from the image store.
 */
export default function ProductMedia({
  src,
  alt,
  tone,
  boards = 4,
  eager = false,
}: {
  src?: string | null;
  alt: string;
  tone?: string | null;
  boards?: number;
  eager?: boolean;
}) {
  if (src) {
    return <img className="absolute inset-0 size-full object-cover" src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />;
  }
  const color = (tone && TONE_COLORS[tone]) || "#6f5a44";
  return (
    <div className="absolute inset-0 grid place-items-center" role="img" aria-label={`${alt} — image coming soon`}>
      <div className="wood" style={{ ["--tone" as string]: color, ["--boards" as string]: boards }} />
      <img
        className="relative w-[34%] max-w-30 opacity-90"
        src="/brand/span-floors-logo.png"
        alt=""
        width={155}
        height={82}
      />
    </div>
  );
}
