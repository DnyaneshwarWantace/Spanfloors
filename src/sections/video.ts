/* YouTube / Vimeo links → ids, embed and thumbnail URLs (shared by admin and site). */

export type VideoInfo = { provider: "youtube" | "vimeo"; id: string; url: string; embed: string; thumbnail: string | null };

export function parseVideo(input: unknown): VideoInfo | null {
  if (typeof input !== "string" || !input.trim()) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.)/, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    yt = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  if (yt && /^[A-Za-z0-9_-]{11}$/.test(yt)) {
    return {
      provider: "youtube",
      id: yt,
      url: `https://www.youtube.com/watch?v=${yt}`,
      embed: `https://www.youtube-nocookie.com/embed/${yt}`,
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{6,12})/)?.[1];
    if (id) return { provider: "vimeo", id, url: `https://vimeo.com/${id}`, embed: `https://player.vimeo.com/video/${id}`, thumbnail: null };
  }
  return null;
}
