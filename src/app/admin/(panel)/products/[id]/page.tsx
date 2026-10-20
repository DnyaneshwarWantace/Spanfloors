import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import ProductExtrasForm from "@/components/admin/ProductExtrasForm";
import ProductMedia from "@/components/ProductMedia";
import { Badge, PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/server/auth";
import { mediaUrl } from "@/server/storage";
import { getAdminProducts, label } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
  return (
    <div className="contents">
      <dt className="text-muted">{k}</dt>
      <dd className={empty ? "text-muted/70" : ""}>{empty ? "—" : v}</dd>
    </div>
  );
}

export default async function ProductEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = (await getAdminProducts()).find((x) => x.id === id);
  if (!p) notFound();

  const [o] = await db.select().from(schema.productOverrides).where(eq(schema.productOverrides.twentyId, id));
  const galleryRows = o?.mediaIds.length
    ? await db.select({ id: schema.media.id, path: schema.media.path, alt: schema.media.alt }).from(schema.media).where(inArray(schema.media.id, o.mediaIds))
    : [];
  const byId = new Map(galleryRows.map((r) => [r.id, r]));
  const gallery = (o?.mediaIds ?? []).map((m) => byId.get(m)).filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => ({ id: r.id, url: mediaUrl(r.path), alt: r.alt }));

  return (
    <>
      <PageHeader
        title={p.displayName}
        description={
          <Link href="/admin/products/" className="hover:underline">
            ← All products
          </Link>
        }
        actions={
          <>
            {p.hiddenByAdmin ? <Badge value="draft" label="Hidden by admin" /> : p.live ? <Badge value="published" label="Live" /> : <Badge value="archived" label="No category in Twenty" />}
            {p.href && p.live && (
              <Link href={p.href} target="_blank" className="inline-flex h-9 items-center border border-ink px-4 text-2xs">
                View on website ↗
              </Link>
            )}
            <a href={`https://spanfloors.twenty.com/object/masterProduct/${p.id}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center px-3 text-2xs text-muted hover:text-ink">
              Open in Twenty ↗
            </a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Read-only Twenty data */}
        <aside className="grid content-start gap-4">
          <div className="relative aspect-[5/6] overflow-hidden bg-paper-2">
            <ProductMedia src={p.images[0]} alt={p.displayName} tone={p.collection} boards={4} />
          </div>
          <section className="border border-line bg-white/40 p-4">
            <h2 className="mb-1 text-2xs font-semibold tracking-[0.06em] uppercase">From Twenty (read-only)</h2>
            <p className="mb-3 text-2xs text-muted">Edit these in Twenty; the website picks up changes automatically.</p>
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 text-2xs">
              <Row k="Name" v={p.name} />
              <Row k="Category" v={p.category && label(p.category)} />
              <Row k="Brand" v={p.brand} />
              <Row k="Format" v={p.format} />
              <Row k="Tone" v={p.collection && label(p.collection)} />
              <Row k="Grade" v={p.grade.map(label).join(", ")} />
              <Row k="Construction" v={p.construction.map(label).join(", ")} />
              <Row k="Installation" v={p.installation.map(label).join(", ")} />
              <Row k="Dimensions" v={p.dimensions} />
              <Row k="Per box" v={p.areaPerBoxSqft != null ? `${p.areaPerBoxSqft} sq ft · ${p.planksPerBox ?? "—"} planks` : null} />
              <Row k="Image ID" v={p.imageId && <code className="font-mono break-all">{p.imageId}</code>} />
              <Row k="Sizes linked" v={p.variants.length || null} />
              <Row k="Updated" v={new Date(p.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
            </dl>
          </section>
        </aside>

        <ProductExtrasForm
          defaultName={p.name}
          twentyImageId={p.imageId}
          initial={{
            twentyId: p.id,
            hidden: o?.hidden ?? false,
            featured: o?.featured ?? false,
            sortOrder: o?.sortOrder ?? 0,
            slug: o?.slug ?? "",
            displayName: o?.displayName ?? "",
            descriptionHtml: o?.descriptionHtml ?? "",
            gallery,
            externalImageIds: o?.externalImageIds ?? [],
            useExternalImages: o?.useExternalImages ?? true,
            seoTitle: o?.seoTitle ?? "",
            seoDescription: o?.seoDescription ?? "",
          }}
        />
      </div>
    </>
  );
}
