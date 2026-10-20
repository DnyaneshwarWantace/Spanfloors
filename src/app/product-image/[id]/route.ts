import { loadApiImage } from "@/server/product-images";

/** Serves product images from the private image API (key stays on the server); cached on disk. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { buf, mime } = await loadApiImage(decodeURIComponent(id));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }
}
