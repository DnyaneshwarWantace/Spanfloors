import "server-only";
import { randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/seo";
import { NOINDEX_SITE } from "./metadata";
import { getSetting, saveSettings } from "./settings";

/**
 * IndexNow: tells Bing, Yandex, Seznam and others that pages changed, so they re-crawl within minutes.
 * Only the live domain pings. The key is created once and served at /indexnow-key.txt.
 */
export async function indexNowKey(): Promise<string> {
  const existing = await getSetting("seo.indexnowKey");
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
  const key = randomBytes(16).toString("hex");
  await saveSettings({ "seo.indexnowKey": key }, null);
  return key;
}

/** Fire-and-forget: never slows down or breaks a save. */
export function pingIndexNow(paths: string[]) {
  // INDEXNOW=off for local copies that use the live address (so testing never pings search engines).
  if (NOINDEX_SITE || process.env.INDEXNOW === "off" || !paths.length) return;
  void (async () => {
    try {
      const key = await indexNowKey();
      const host = new URL(SITE_URL).host;
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/indexnow-key.txt`, urlList: [...new Set(paths)].slice(0, 100).map((p) => `${SITE_URL}${p}`) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 202) console.warn(`[indexnow] ${res.status} for ${paths.join(", ")}`);
    } catch (e) {
      console.warn("[indexnow] ping failed:", (e as Error).message);
    }
  })();
}
