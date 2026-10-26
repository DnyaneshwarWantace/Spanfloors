import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { resolveStored } from "@/server/storage";

/**
 * Branded share image (1200 × 630) for pages without a chosen share image:
 *   /og/?title=…&kicker=…&img=/media/…
 * WhatsApp, Telegram, LinkedIn and Facebook fetch this when a link is shared. Only our own media files are
 * used as the photo. Sent as JPEG (about 100 KB) because WhatsApp skips preview images much over 300 KB.
 */

export const runtime = "nodejs";

let logoCache: string | null = null;
async function logo() {
  logoCache ??= `data:image/png;base64,${(await readFile(join(process.cwd(), "public/brand/span-floors-logo-dark.png"))).toString("base64")}`;
  return logoCache;
}

async function photo(img: string | null) {
  if (!img || !img.startsWith("/media/")) return null;
  const full = resolveStored(decodeURIComponent(img.slice("/media/".length).split("?")[0]));
  if (!full) return null;
  try {
    const jpg = await sharp(full, { failOn: "none" }).rotate().resize(560, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const clip = (k: string, d: string, n: number) => (u.searchParams.get(k)?.trim() || d).slice(0, n);
  const title = clip("title", "Wooden flooring, decking and facades", 110);
  const kicker = clip("kicker", "Span Floors", 60);
  const [lg, ph] = await Promise.all([logo(), photo(u.searchParams.get("img"))]);
  const size = title.length > 70 ? 46 : title.length > 40 ? 56 : 66;

  try {
    const img = new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", background: "#f5f0eb", color: "#191919" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: ph ? 640 : 1200, padding: "56px 60px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lg} height={64} style={{ height: 64, alignSelf: "flex-start" }} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: "#7a7976" }}>{kicker}</div>
              <div style={{ marginTop: 18, fontSize: size, lineHeight: 1.08, letterSpacing: -1 }}>{title}</div>
              <div style={{ display: "flex", width: 80, height: 6, background: "#ed3237", marginTop: 28 }} />
            </div>
            <div style={{ fontSize: 22, color: "#7a7976" }}>spanfloors.com</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {ph && <img src={ph} width={560} height={630} style={{ width: 560, height: 630, objectFit: "cover" }} alt="" />}
        </div>
      ),
      { width: 1200, height: 630 },
    );
    const png = Buffer.from(await img.arrayBuffer());
    const jpg = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  } catch (e) {
    console.error("[og] share image failed:", (e as Error).message);
    const fallback = await readFile(join(process.cwd(), "public/brand/span-floors-logo.png"));
    return new Response(new Uint8Array(fallback), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=600" } });
  }
}
