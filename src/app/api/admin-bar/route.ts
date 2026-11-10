import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { CATEGORIES, getFullCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const none = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

/**
 * For the "Edit this page" bar on the website: given a page address, says where it is edited in the admin.
 * Answers only signed-in admin users; everyone else gets an empty reply.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return none();
  const raw = req.nextUrl.searchParams.get("path") ?? "/";
  const path = (raw.split(/[?#]/)[0] || "/").replace(/\/?$/, "/").slice(0, 500);
  let edit: string | null = null;
  let what = "this page";

  if (can(user.role, "content")) {
    const [row] = await db
      .select({ id: schema.content.id, type: schema.content.type, authorId: schema.content.authorId, systemKey: schema.content.systemKey })
      .from(schema.content)
      .where(eq(schema.content.path, path))
      // A fixed site page (home, blog, a collection) wins over an old imported page at the same address.
      .orderBy(sql`${schema.content.systemKey} is null`)
      .limit(1);
    if (row && (can(user.role, "content.all") || (row.type === "post" && row.authorId === user.id))) {
      edit = `/admin/content/${row.id}/`;
      what = row.type === "post" ? "this post" : "this page";
    }
  }
  const author = path.match(/^\/blog\/author\/([^/]+)\/$/)?.[1];
  if (!edit && author && can(user.role, "content.all")) {
    const [a] = await db.select({ id: schema.authors.id }).from(schema.authors).where(eq(schema.authors.slug, author));
    if (a) {
      edit = `/admin/content/authors/${a.id}/`;
      what = "this author";
    }
  }
  if (!edit && can(user.role, "products") && CATEGORIES.some((c) => path.startsWith(`/${c.slug}/`) && path !== `/${c.slug}/`)) {
    const p = (await getFullCatalog().catch(() => [])).find((x) => x.href === path);
    if (p) {
      edit = `/admin/products/${p.id}/`;
      what = "this product";
    }
  }
  return NextResponse.json({ name: user.name.split(" ")[0], edit, what }, { headers: { "Cache-Control": "private, no-store" } });
}
